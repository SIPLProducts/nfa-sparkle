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
    (d: { name: string; description?: string; module: string; auth_type: string; path_or_url: string }) => d,
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
    const [{ data: ep }, { data: conn }] = await Promise.all([
      db.from("sap_endpoint").select("*").eq("id", data.id).maybeSingle(),
      db.from("sap_connection").select("*").limit(1).maybeSingle(),
    ]);
    if (!ep) throw new Error("Endpoint not found");

    const base = (conn?.base_url ?? "").replace(/\/+$/, "");
    const raw: string = ep.path_or_url ?? "";
    const url = /^https?:\/\//i.test(raw) ? raw : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
    if (!/^https?:\/\//i.test(url)) throw new Error("No usable URL — set the SAP Base URL or use a full URL");

    const target = new URL(url);
    for (const [k, v] of Object.entries((ep.request_query ?? {}) as Record<string, string>)) {
      if (k) target.searchParams.set(k, v);
    }

    const headers: Record<string, string> = { ...((ep.request_headers ?? {}) as Record<string, string>) };
    if (ep.auth_type === "basic") {
      const user = ep.username || conn?.username || "";
      const pwd = (await getSecret(`endpoint:${ep.id}`)) ?? (await getSecret("sap_password")) ?? "";
      if (user) headers["Authorization"] = "Basic " + btoa(`${user}:${pwd}`);
    }
    const method = (ep.http_method ?? "GET").toUpperCase();
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD" && ep.request_body) {
      body = ep.request_body;
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    }

    const r = await fetchWithTimeout(target.toString(), { method, headers, body });
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
