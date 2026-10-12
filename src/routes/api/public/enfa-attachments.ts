import { createFileRoute } from "@tanstack/react-router";
import { extractFiles } from "@/lib/sap-attachment-response";

interface SapFile {
  filename: string;
  base64: string;
  mime: string;
}

interface CacheEntry {
  files: SapFile[];
  message: string | null;
  status: number | null;
  latencyMs: number;
  at: number;
  /** Exactly what was sent to SAP — surfaced via x-sap-* headers. */
  request?: { url: string; method: string; body: string };
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 20;
const cache = new Map<string, CacheEntry>();


function readCache(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, entry: CacheEntry) {
  cache.set(key, entry);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Shared cache row so a warm result survives cold starts and other server instances. */
async function readDbCache(key: string): Promise<CacheEntry | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("sap_attachment_cache")
      .select("payload, status, latency_ms, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    const at = new Date(data.fetched_at).getTime();
    if (!Number.isFinite(at) || Date.now() - at > CACHE_TTL_MS) return null;
    const payload = data.payload as { files?: SapFile[]; message?: string | null };
    return {
      files: Array.isArray(payload?.files) ? payload.files : [],
      message: payload?.message ?? null,
      status: data.status ?? null,
      latencyMs: data.latency_ms ?? 0,
      at,
    };
  } catch {
    return null;
  }
}

async function writeDbCache(key: string, entry: CacheEntry) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("sap_attachment_cache").upsert({
      cache_key: key,
      payload: { files: entry.files, message: entry.message },
      status: entry.status,
      latency_ms: entry.latencyMs,
      fetched_at: new Date(entry.at).toISOString(),
    });
  } catch {
    /* cache writes are best-effort */
  }
}

async function clearDbCache(key: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("sap_attachment_cache").delete().eq("cache_key", key);
  } catch {
    /* best effort */
  }
}

/* ------------------------------ SAP round-trip ----------------------------- */

/** Calls SAP, stores the result in both caches and returns it, all inside the request. */
async function fetchAttachments(
  key: string,
  reffld: string,
  target: "report" | "my",
): Promise<{ entry: CacheEntry } | { error: string }> {
  try {
    const { callEnfaAttachments } = await import("@/lib/sap-report.server");
    const result = await callEnfaAttachments(reffld, target);
    if (!result.ok) {
      const status = result.status ?? null;
      console.error("[enfa-attachments] SAP call failed:", status, result.error);
      return {
        error:
          status !== null && status >= 500
            ? "SAP took too long to return the documents for this eNFA. Please try again in a moment."
            : (result.error || "SAP request failed"),
      };
    }

    // Unwrap the middleware envelope if it slipped through.
    let body = result.body || "";
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
        const inner = (parsed as { body: unknown }).body;
        body = typeof inner === "string" ? inner : JSON.stringify(inner ?? []);
      }
    } catch {
      /* raw body */
    }

    const { files, message } = extractFiles(body);
    const entry: CacheEntry = {
      files,
      message,
      status: result.status ?? null,
      latencyMs: result.latencyMs ?? 0,
      at: Date.now(),
      ...(result.request ? { request: result.request } : {}),
    };
    writeCache(key, entry);
    await writeDbCache(key, entry);
    return { entry };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "SAP request failed" };
  }
}








export const Route = createFileRoute("/api/public/enfa-attachments")({
  server: {
    handlers: {
      POST: async ({ request, context }: any) => {


        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json({ error: "Unauthorized: no session token was sent" }, { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        if (token.split(".").length !== 3) {
          return Response.json({ error: "Unauthorized: malformed session token" }, { status: 401 });
        }

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) {
          return Response.json({ error: "Server is not configured for authentication" }, { status: 500 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input: any, init: any) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
        }

        let input: Record<string, any> = {};
        try {
          input = (await request.json()) as Record<string, any>;
        } catch {
          input = {};
        }
        const att = (input["attachment"] ?? input["ATTACHMENT"] ?? {}) as Record<string, unknown>;
        const reffld = String(att["reffld"] ?? att["REFFLD"] ?? input["reffld"] ?? "").trim();
        if (!reffld) {
          return Response.json({ error: "An eNFA number is required" }, { status: 400 });
        }

        const target = input["endpoint"] === "my" ? "my" : "report";
        const mode = input["mode"] === "content" ? "content" : "list";
        const wantIndex = Number(input["index"] ?? -1);
        const cacheKey = `${target}:${reffld}`;
        if (input["refresh"] === true) {
          cache.delete(cacheKey);
          await clearDbCache(cacheKey);
        }

        const baseHeaders: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
        };

        let cached = readCache(cacheKey);
        if (!cached) cached = await readDbCache(cacheKey);
        if (cached) writeCache(cacheKey, cached);

        if (!cached) {
          const fetched = await fetchAttachments(cacheKey, reffld, target);
          if ("error" in fetched) {
            return new Response(JSON.stringify({ error: fetched.error }), {
              status: 502,
              headers: baseHeaders,
            });
          }
          cached = fetched.entry;
        }
        const entry: CacheEntry = cached;







        const headers: Record<string, string> = {
          ...baseHeaders,
          "x-sap-status": String(entry.status ?? ""),
          "x-sap-url": entry.request?.url ?? "",
          "x-sap-method": entry.request?.method ?? "",
          "x-sap-request": String(entry.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000),
          "x-sap-latency-ms": String(entry.latencyMs ?? 0),
        };

        if (mode === "content") {
          const file = entry.files[wantIndex];
          if (!file) {
            return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers });
          }
          return new Response(
            JSON.stringify({ file: { filename: file.filename, mime: file.mime, base64: file.base64 } }),
            { status: 200, headers },
          );
        }

        const files = entry.files.map((f, index) => ({
          index,
          filename: f.filename,
          mime: f.mime,
          size: Math.round((f.base64.length * 3) / 4),
        }));
        return new Response(
          JSON.stringify({ status: entry.status, latencyMs: entry.latencyMs, files, message: entry.message }),
          { status: 200, headers },
        );

      },
    },
  },
});
