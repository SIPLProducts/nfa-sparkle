/** Server-only SAP access helpers shared by server functions and API routes. */

export interface SapCallResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  body: string;
  error: string | null;
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getSecret(key: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("sap_secret").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setSecret(key: string, value: string | null | undefined) {
  if (value === undefined || value === null || value === "") return;
  const db = await admin();
  await db.from("sap_secret").upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function hasSecret(key: string) {
  return (await getSecret(key)) !== null;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 15000,
  maxBytes = 4000,
): Promise<SapCallResult> {
  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  try {
    const res = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
    const text = (await res.text()).slice(0, maxBytes);
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - started, body: text, error: null };
  } catch (e) {
    const aborted =
      timedOut ||
      (e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message)));
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      body: "",
      error: aborted
        ? `SAP did not respond within ${Math.round(ms / 1000)} seconds — the file may be too large or the SAP service is slow. Please try again.`
        : e instanceof Error
          ? e.message
          : "Request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function systemBaseUrl(s: {
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

export async function loadSystem(systemId: string | null) {
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
export async function callSap(opts: {
  system: Record<string, any> | null;
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
  username?: string;
  password?: string;
  maxBytes?: number;
  timeoutMs?: number;
}): Promise<SapCallResult> {
  const db = await admin();
  // Fetch the middleware config and its shared secret concurrently — one round-trip instead of two.
  const [{ data: mw }, secretValue] = await Promise.all([
    db.from("sap_middleware_config").select("*").limit(1).maybeSingle(),
    getSecret("middleware_secret"),
  ]);
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
    const secret = secretValue ?? "";

    const limit = opts.maxBytes ?? 4000;
    const timeoutMs = opts.timeoutMs ?? 20000;
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
      timeoutMs,
    };
    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-secret": secret },
      body: JSON.stringify(payload),
    }, timeoutMs + 5000, Math.max(limit + 4000, 8000));
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
        body:
          typeof parsed.body === "string"
            ? parsed.body
            : JSON.stringify(parsed.body ?? "").slice(0, limit),
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
  return fetchWithTimeout(
    target.toString(),
    { method: opts.method, headers, body: opts.body },
    opts.timeoutMs ?? 15000,
    opts.maxBytes ?? 4000,
  );
}
