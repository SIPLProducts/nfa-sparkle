import { createFileRoute } from "@tanstack/react-router";

interface SapFile {
  filename: string;
  base64: string;
  mime: string;
}

const B64 = /^[A-Za-z0-9+/\r\n=]+$/;

interface CacheEntry {
  files: SapFile[];
  message: string | null;
  status: number | null;
  latencyMs: number;
  at: number;
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

/* ----------------------------- background jobs ----------------------------- */

/** Longer than the SAP call budget (170 s) so a genuinely running job is never declared stale. */
const JOB_STALE_MS = 200 * 1000;

type JobRow = { state: string; error: string | null; started_at: string };

async function readJob(key: string): Promise<JobRow | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("sap_attachment_job")
      .select("state, error, started_at")
      .eq("cache_key", key)
      .maybeSingle();
    return (data as JobRow) ?? null;
  } catch {
    return null;
  }
}

async function writeJob(key: string, state: string, error: string | null, startedAt?: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("sap_attachment_job").upsert({
      cache_key: key,
      state,
      error,
      ...(startedAt ? { started_at: startedAt } : {}),
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* best effort */
  }
}

function jobIsRunning(job: JobRow | null) {
  if (!job || job.state !== "running") return false;
  const started = new Date(job.started_at).getTime();
  return Number.isFinite(started) && Date.now() - started < JOB_STALE_MS;
}

/** Runs the SAP round-trip outside the browser request and stores the result in the shared cache. */
async function runAttachmentJob(key: string, reffld: string, target: "report" | "my") {
  try {
    const { callEnfaAttachments } = await import("@/lib/sap-report.server");
    const result = await callEnfaAttachments(reffld, target);
    if (!result.ok) {
      const status = result.status ?? null;
      const message =
        status !== null && status >= 500
          ? "SAP took too long to return the documents for this eNFA. Please try again in a moment."
          : (result.error || "SAP request failed");
      console.error("[enfa-attachments] SAP call failed:", status, result.error);
      await writeJob(key, "error", message);
      return;
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
    };
    writeCache(key, entry);
    await writeDbCache(key, entry);
    await writeJob(key, "done", null);
  } catch (e) {
    await writeJob(key, "error", e instanceof Error ? e.message : "SAP request failed");
  }
}



function sniffMime(name: string, base64: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(n)) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const head = base64.slice(0, 8);
  if (head.startsWith("JVBER")) return "application/pdf";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UEsDB")) return "application/zip";
  return "application/octet-stream";
}

/** Pulls `{ FILE_NAME, FILE_CONTENT }` entries out of whatever shape SAP / the middleware returns. */
function extractFiles(raw: string): { files: SapFile[]; message: string | null } {
  const text = (raw ?? "").trim();
  if (!text) return { files: [], message: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { files: [], message: null };
  }

  const files: SapFile[] = [];
  let message: string | null = null;
  const seen = new Set<unknown>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const nameKey = Object.keys(obj).find((k) => /^(file_name|filename|name)$/i.test(k));
    const contentKey = Object.keys(obj).find((k) => /^(file_content|filecontent|content|file|data)$/i.test(k));
    const content = contentKey ? obj[contentKey] : undefined;
    if (typeof content === "string" && content.trim().length > 50 && B64.test(content.trim())) {
      const base64 = content.replace(/\s+/g, "");
      const filename = String((nameKey ? obj[nameKey] : "") || `document-${files.length + 1}`).trim();
      files.push({ filename, base64, mime: sniffMime(filename, base64) });
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && /message|msg|error/i.test(k) && v.trim() && !message) message = v.trim();
    }
    for (const v of Object.values(obj)) walk(v);
  };

  walk(parsed);
  return { files, message };
}

export const Route = createFileRoute("/api/public/enfa-attachments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaAttachments } = await import("@/lib/sap-report.server");

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
          inFlight.delete(cacheKey);
          await clearDbCache(cacheKey);
          await writeJob(cacheKey, "idle", null);
        }

        const baseHeaders: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
        };

        let entry = readCache(cacheKey);
        if (!entry) entry = await readDbCache(cacheKey);
        if (entry) writeCache(cacheKey, entry);

        if (!entry) {
          // The SAP attachments service can take ~95 s for large records — far beyond the
          // edge request window. Run it as a background job and let the client poll.
          const job = await readJob(cacheKey);
          if (job?.state === "error" && !inFlight.has(cacheKey)) {
            await writeJob(cacheKey, "idle", null);
            return new Response(JSON.stringify({ error: job.error || "SAP request failed" }), {
              status: 502,
              headers: baseHeaders,
            });
          }
          if (!jobIsRunning(job) && !inFlight.has(cacheKey)) {
            await writeJob(cacheKey, "running", null, new Date().toISOString());
            const task = runAttachmentJob(cacheKey, reffld, target).finally(() =>
              inFlight.delete(cacheKey),
            );
            inFlight.set(cacheKey, task);
            keepAlive(context, task);
          }
          return new Response(JSON.stringify({ pending: true }), { status: 202, headers: baseHeaders });
        }





        const headers: Record<string, string> = {
          ...baseHeaders,
          "x-sap-status": String(entry.status ?? ""),
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
