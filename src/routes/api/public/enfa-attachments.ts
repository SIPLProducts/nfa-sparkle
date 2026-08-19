import { createFileRoute } from "@tanstack/react-router";

interface SapFile {
  filename: string;
  base64: string;
  mime: string;
}

const B64 = /^[A-Za-z0-9+/\r\n=]+$/;

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

        const result = await callEnfaAttachments(reffld);

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          console.error("[enfa-attachments] SAP call failed:", result.status, result.error);
          return new Response(
            JSON.stringify({ error: result.error ?? "SAP request failed", status: result.status }),
            { status: result.status && result.status >= 400 ? result.status : 502, headers },
          );
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
        return new Response(
          JSON.stringify({ status: result.status, latencyMs: result.latencyMs, files, message }),
          { status: 200, headers },
        );
      },
    },
  },
});
