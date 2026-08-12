import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SapEndpoint {
  id: string;
  name: string;
  description: string | null;
  module: string;
  path_or_url: string;
  http_method: string;
  auth_type: string;
  api_type: string;
  active: boolean;
  username: string | null;
  system_id: string | null;
  request_headers: Record<string, string>;
  request_query: Record<string, string>;
  request_body: string | null;
  schedule_enabled: boolean;
  schedule_cron: string | null;
  last_test_at: string | null;
  last_test_status: number | null;
  last_test_ok: boolean | null;
  last_test_ms: number | null;
  last_test_body: string | null;
  last_test_error: string | null;
  last_synced_at: string | null;
  has_password: boolean;
}

export interface TestResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  body: string;
  error: string | null;
}

export interface SapSystem {
  id: string;
  key: string;
  label: string;
  environment: string;
  protocol: string;
  host: string;
  port: number;
  sap_client: string;
  base_path: string;
  username: string;
  route_via_middleware: boolean;
  is_active: boolean;
  notes: string | null;
  has_password: boolean;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function getSecret(key: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("sap_secret").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function setSecret(key: string, value: string | null | undefined) {
  if (value === undefined || value === null || value === "") return;
  const db = await admin();
  await db.from("sap_secret").upsert({ key, value, updated_at: new Date().toISOString() });
}

async function hasSecret(key: string) {
  return (await getSecret(key)) !== null;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 15000): Promise<TestResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
    const text = (await res.text()).slice(0, 4000);
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - started, body: text, error: null };
  } catch (e) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      body: "",
      error: e instanceof Error ? e.message : "Request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- system resolution --------------------------- */

function systemBaseUrl(s: {
  protocol?: string | null;
  host?: string | null;
  port?: number | null;
  base_path?: string | null;
}) {
  if (!s.host) return "";
  const proto = s.protocol === "https" ? "https" : "http";
  const port = s.port ? `:${s.port}` : "";
  const basePath = (s.base_path ?? "").replace(/\/+$/, "");
  return `${proto}://${s.host}${port}${basePath}`;
}

async function loadSystem(systemId: string | null) {
  const db = await admin();
  const q = db.from("sap_system").select("*");
  const { data } = systemId
    ? await q.eq("id", systemId).maybeSingle()
    : await q.eq("is_active", true).limit(1).maybeSingle();
  return data as Record<string, any> | null;
}

/**
 * Executes a SAP call either directly or through the on-prem Node.js middleware,
 * depending on the middleware Connection Mode and the system's routing flag.
 */
async function callSap(opts: {
  system: Record<string, any> | null;
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
  username?: string;
  password?: string;
}): Promise<TestResult> {
  const db = await admin();
  const { data: mw } = await db.from("sap_middleware_config").select("*").limit(1).maybeSingle();
  const viaProxy =
    mw?.connection_mode === "proxy" && !!mw?.url && (opts.system?.route_via_middleware ?? true);

  const base = systemBaseUrl(opts.system ?? {});
  const raw = opts.path ?? "";
  const isAbsolute = /^https?:\/\//i.test(raw);
  const query: Record<string, string> = { ...(opts.query ?? {}) };
  if (opts.system?.sap_client && !("sap-client" in query) && !/sap-client=/.test(raw)) {
    query["sap-client"] = String(opts.system.sap_client);
  }

  if (viaProxy) {
    const secret = (await getSecret("middleware_secret")) ?? "";
    const url = `${mw!.url.replace(/\/+$/, "")}/sap/call`;
    const payload = {
      system: opts.system?.key ?? undefined,
      baseUrl: isAbsolute ? undefined : base || undefined,
      method: opts.method,
      path: raw,
      query,
      headers: opts.headers ?? {},
      body: opts.body,
      auth: opts.username ? { username: opts.username, password: opts.password ?? "" } : undefined,
    };
    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-secret": secret },
      body: JSON.stringify(payload),
    });
    if (!r.ok && r.status === null) return r;
    try {
      const parsed = JSON.parse(r.body) as {
        ok?: boolean;
        status?: number | null;
        latencyMs?: number;
        body?: unknown;
        error?: string | null;
      };
      return {
        ok: !!parsed.ok,
        status: parsed.status ?? r.status,
        latencyMs: parsed.latencyMs ?? r.latencyMs,
        body: typeof parsed.body === "string" ? parsed.body : JSON.stringify(parsed.body ?? "", null, 2).slice(0, 4000),
        error: parsed.error ?? null,
      };
    } catch {
      return r;
    }
  }

  if (!isAbsolute && !base) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error: "No SAP system configured — add a system in SAP Systems or use a full URL",
    };
  }
  const target = new URL(isAbsolute ? raw : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`);
  for (const [k, v] of Object.entries(query)) if (k) target.searchParams.set(k, v);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.username && !headers["Authorization"]) {
    headers["Authorization"] = "Basic " + btoa(`${opts.username}:${opts.password ?? ""}`);
  }
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return fetchWithTimeout(target.toString(), { method: opts.method, headers, body: opts.body });
}

/* ------------------------------ sap systems ------------------------------ */

export const listSapSystems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data } = await db.from("sap_system").select("*").order("created_at", { ascending: true });
    const rows = (data ?? []) as Record<string, any>[];
    const out: SapSystem[] = [];
    for (const r of rows) out.push({ ...(r as any), has_password: await hasSecret(`system:${r.id}`) });
    return out;
  });

export const saveSapSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      key: string;
      label: string;
      environment: string;
      protocol: string;
      host: string;
      port: number;
      sap_client: string;
      base_path: string;
      username: string;
      route_via_middleware: boolean;
      notes?: string;
      password?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!data.key.trim()) throw new Error("System key is required");
    if (!data.host.trim()) throw new Error("Host / IP is required");
    const db = await admin();
    const payload = {
      key: data.key.trim(),
      label: data.label.trim(),
      environment: data.environment,
      protocol: data.protocol,
      host: data.host.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""),
      port: Number(data.port) || 8000,
      sap_client: data.sap_client.trim(),
      base_path: data.base_path.trim(),
      username: data.username.trim(),
      route_via_middleware: data.route_via_middleware,
      notes: data.notes?.trim() || null,
    };
    let id = data.id;
    if (id) {
      const { error } = await db.from("sap_system").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { count } = await db.from("sap_system").select("id", { count: "exact", head: true });
      const { data: row, error } = await db
        .from("sap_system")
        .insert({ ...payload, is_active: (count ?? 0) === 0 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }
    await setSecret(`system:${id}`, data.password);
    return { id };
  });

export const activateSapSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    await db.from("sap_system").update({ is_active: false }).eq("is_active", true);
    const { error } = await db.from("sap_system").update({ is_active: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSapSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    await db.from("sap_system").delete().eq("id", data.id);
    await db.from("sap_secret").delete().eq("key", `system:${data.id}`);
    return { ok: true };
  });

export const testSapSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; path?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const sys = await loadSystem(data.id);
    if (!sys) throw new Error("System not found");
    const r = await callSap({
      system: sys,
      path: data.path?.trim() || "/",
      method: "GET",
      username: sys.username || undefined,
      password: (await getSecret(`system:${sys.id}`)) ?? undefined,
    });
    await logTest(null, `system:${sys.key}`, r, (context as any).userId);
    return r;
  });

/* ------------------------------ settings ------------------------------ */

export const getSapSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const [{ data: conn }, { data: mw }] = await Promise.all([
      db.from("sap_connection").select("*").limit(1).maybeSingle(),
      db.from("sap_middleware_config").select("*").limit(1).maybeSingle(),
    ]);
    return {
      connection: {
        environment: conn?.environment ?? "DEV",
        base_url: conn?.base_url ?? "",
        username: conn?.username ?? "",
        has_password: await hasSecret("sap_password"),
      },
      middleware: {
        connection_mode: mw?.connection_mode ?? "proxy",
        deployment_mode: mw?.deployment_mode ?? "lovable_cloud",
        port: mw?.port ?? 3005,
        url: mw?.url ?? "",
        has_secret: await hasSecret("middleware_secret"),
      },
    };
  });

export const saveSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: string; base_url: string; username: string; password?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: row } = await db.from("sap_connection").select("id").limit(1).maybeSingle();
    const payload = { environment: data.environment, base_url: data.base_url.trim(), username: data.username.trim() };
    if (row) await db.from("sap_connection").update(payload).eq("id", row.id);
    else await db.from("sap_connection").insert(payload);
    await setSecret("sap_password", data.password);
    return { ok: true };
  });

export const saveMiddlewareConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { connection_mode: string; deployment_mode: string; port: number; url: string; secret?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: row } = await db.from("sap_middleware_config").select("id").limit(1).maybeSingle();
    const payload = {
      connection_mode: data.connection_mode,
      deployment_mode: data.deployment_mode,
      port: Number(data.port) || 3005,
      url: data.url.trim(),
    };
    if (row) await db.from("sap_middleware_config").update(payload).eq("id", row.id);
    else await db.from("sap_middleware_config").insert(payload);
    await setSecret("middleware_secret", data.secret);
    return { ok: true };
  });

/* ------------------------------ endpoints ------------------------------ */

export const listSapEndpoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data } = await db.from("sap_endpoint").select("*").order("created_at", { ascending: true });
    return (data ?? []) as SapEndpoint[];
  });

export const getSapEndpoint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: row } = await db.from("sap_endpoint").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Endpoint not found");
    return { ...row, has_password: await hasSecret(`endpoint:${data.id}`) } as SapEndpoint;
  });

export const createSapEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      description?: string;
      module: string;
      auth_type: string;
      path_or_url: string;
      system_id?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!data.name.trim()) throw new Error("Name is required");
    const db = await admin();
    const { data: row, error } = await db
      .from("sap_endpoint")
      .insert({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        module: data.module,
        auth_type: data.auth_type,
        path_or_url: data.path_or_url.trim(),
        system_id: data.system_id || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateSapEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown>; password?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { error } = await db.from("sap_endpoint").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await setSecret(`endpoint:${data.id}`, data.password);
    return { ok: true };
  });

export const deleteSapEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    await db.from("sap_endpoint").delete().eq("id", data.id);
    await db.from("sap_secret").delete().eq("key", `endpoint:${data.id}`);
    return { ok: true };
  });

/* -------------------------------- tests -------------------------------- */

async function logTest(
  endpointId: string | null,
  target: string,
  r: TestResult,
  actorId: string,
) {
  const db = await admin();
  await db.from("sap_test_log").insert({
    endpoint_id: endpointId,
    target,
    ok: r.ok,
    status: r.status,
    latency_ms: r.latencyMs,
    message: r.error ?? r.body.slice(0, 500),
    actor_id: actorId,
  });
}

export const testSapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: conn } = await db.from("sap_connection").select("*").limit(1).maybeSingle();
    if (!conn?.base_url) throw new Error("Set the SAP Base URL first");
    const pwd = (await getSecret("sap_password")) ?? "";
    const headers: Record<string, string> = {};
    if (conn.username) headers["Authorization"] = "Basic " + btoa(`${conn.username}:${pwd}`);
    const r = await fetchWithTimeout(conn.base_url, { method: "GET", headers });
    await logTest(null, "sap_connection", r, (context as any).userId);
    return r;
  });

export const testMiddleware = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: mw } = await db.from("sap_middleware_config").select("*").limit(1).maybeSingle();
    if (!mw?.url) throw new Error("Set the Node.js Middleware URL first");
    const secret = await getSecret("middleware_secret");
    const headers: Record<string, string> = {};
    if (secret) headers["x-proxy-secret"] = secret;
    const r = await fetchWithTimeout(mw.url, { method: "GET", headers });
    await logTest(null, "middleware", r, (context as any).userId);
    return r;
  });

export const testSapEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: ep } = await db.from("sap_endpoint").select("*").eq("id", data.id).maybeSingle();
    if (!ep) throw new Error("Endpoint not found");

    const sys = await loadSystem(ep.system_id ?? null);
    const headers: Record<string, string> = { ...((ep.request_headers ?? {}) as Record<string, string>) };
    const method = (ep.http_method ?? "GET").toUpperCase();
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD" && ep.request_body) body = ep.request_body;

    const username =
      ep.auth_type === "basic" ? ep.username || sys?.username || "" : "";
    const password =
      (await getSecret(`endpoint:${ep.id}`)) ??
      (sys ? await getSecret(`system:${sys.id}`) : null) ??
      (await getSecret("sap_password")) ??
      "";

    const r = await callSap({
      system: sys,
      path: ep.path_or_url ?? "",
      method,
      headers,
      query: (ep.request_query ?? {}) as Record<string, string>,
      body,
      username: username || undefined,
      password,
    });
    await db
      .from("sap_endpoint")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: r.status,
        last_test_ok: r.ok,
        last_test_ms: r.latencyMs,
        last_test_body: r.body,
        last_test_error: r.error,
        last_synced_at: r.ok ? new Date().toISOString() : ep.last_synced_at,
      })
      .eq("id", ep.id);
    await logTest(ep.id, ep.name, r, (context as any).userId);
    return r;
  });

export const listSapTestLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpointId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: rows } = await db
      .from("sap_test_log")
      .select("*")
      .eq("endpoint_id", data.endpointId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (rows ?? []) as {
      id: string;
      ok: boolean;
      status: number | null;
      latency_ms: number | null;
      message: string | null;
      created_at: string;
    }[];
  });

/* ---------------------------- eNFA report feed ---------------------------- */

export interface SapReportFilters {
  plant_from: string;
  plant_to: string;
  funct_from: string;
  funct_to: string;
  nfano_from: string;
  nfano_to: string;
  extra_from: string;
  extra_to: string;
  dat_from: string;
  dat_to: string;
  usrid_from: string;
  usrid_to: string;
  r_proc: string;
  r_comp: string;
  r_reje: string;
}

export interface SapReportRow {
  REFFLD: string;
  PSPNR: string;
  NAME1: string;
  FUNCT_TXT: string;
  EXTR_TXT: string;
  SUBJECT: string;
  INIT_NAME: string;
  BEGDA: string;
  ROLE1: string; APPR1: string; STAT1: string;
  ROLE2: string; APPR2: string; STAT2: string;
  ROLE3: string; APPR3: string; STAT3: string;
  ROLE4: string; APPR4: string; STAT4: string;
  ROLE5: string; APPR5: string; STAT5: string;
  ROLE6: string; APPR6: string; STAT6: string;
  STATUS_TXT: string;
}

const REPORT_KEYS: (keyof SapReportFilters)[] = [
  "plant_from", "plant_to", "funct_from", "funct_to", "nfano_from", "nfano_to",
  "extra_from", "extra_to", "dat_from", "dat_to", "usrid_from", "usrid_to",
  "r_proc", "r_comp", "r_reje",
];

function normaliseRows(raw: unknown): SapReportRow[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const k of ["body", "data", "ITEMS", "items", "result", "RESULT"]) {
      if (Array.isArray(obj[k])) { value = obj[k]; break; }
    }
  }
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[k.trim().toUpperCase()] = v == null ? "" : String(v);
    return out as unknown as SapReportRow;
  });
}

export const runSapEnfaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<SapReportFilters>) => d)
  .handler(async ({ data }) => {
    const payload = {} as SapReportFilters;
    for (const k of REPORT_KEYS) payload[k] = (data?.[k] ?? "").toString().trim();

    const db = await admin();
    const { data: ep } = await db
      .from("sap_endpoint")
      .select("*")
      .or("name.eq.eNFA Report,path_or_url.ilike.%enfa_report%")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ep) {
      return {
        ok: false, status: null as number | null, latencyMs: 0,
        rows: [] as SapReportRow[], payload, raw: "",
        error: "The eNFA Report endpoint is not registered in API Settings.",
      };
    }

    const sys = await loadSystem(ep.system_id ?? null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((ep.request_headers ?? {}) as Record<string, string>),
    };
    const username = ep.username || sys?.username || "";
    const password =
      (await getSecret(`endpoint:${ep.id}`)) ??
      (sys ? await getSecret(`system:${sys.id}`) : null) ??
      (await getSecret("sap_password")) ??
      "";

    const r = await callSap({
      system: sys,
      path: ep.path_or_url ?? "",
      method: (ep.http_method ?? "PUT").toUpperCase(),
      headers,
      query: (ep.request_query ?? {}) as Record<string, string>,
      body: JSON.stringify(payload),
      username: username || undefined,
      password,
    });

    return {
      ok: r.ok,
      status: r.status,
      latencyMs: r.latencyMs,
      rows: r.ok ? normaliseRows(r.body) : [],
      payload,
      raw: r.body,
      error: r.error,
    };
  });
