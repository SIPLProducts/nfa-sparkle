import { createFileRoute } from "@tanstack/react-router";

/** Pulls STATUS / MESSAGE / ENFA_NO out of whatever envelope the middleware returns. */
function extractResult(raw: string): { status: string | null; message: string | null; enfaNo: string | null } {
  const text = (raw ?? "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: null, message: text || null, enfaNo: null };
  }

  let status: string | null = null;
  let message: string | null = null;
  let enfaNo: string | null = null;
  const seen = new Set<unknown>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === "string") {
        if (/^status$/i.test(k) && !status) status = v.trim();
        else if (/^(message|msg|error)$/i.test(k) && !message) message = v.trim();
        else if (/^enfa_?no$/i.test(k) && !enfaNo) enfaNo = v.trim();
      }
      walk(v);
    }
  };
  walk(parsed);
  return { status, message, enfaNo };
}

export const Route = createFileRoute("/api/public/enfa-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaUpload } = await import("@/lib/sap-report.server");

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
        const up = (input["upload"] ?? input["UPLOAD"] ?? {}) as Record<string, unknown>;
        const endpoint = String(input["endpoint"] ?? "report").toLowerCase() === "my" ? "my" : "report";
        const reffld = String(up["reffld"] ?? up["REFFLD"] ?? input["reffld"] ?? "").trim();
        const rawFiles = Array.isArray(up["file"]) ? (up["file"] as any[]) : [];
        const files = rawFiles
          .map((f) => ({
            file_name: String(f?.file_name ?? f?.filename ?? f?.name ?? "").trim(),
            file: String(f?.file ?? f?.file_content ?? f?.content ?? ""),
          }))
          .filter((f) => f.file_name && f.file);

        if (!reffld) return Response.json({ error: "An eNFA number is required" }, { status: 400 });
        if (!files.length) return Response.json({ error: "No files to upload" }, { status: 400 });

        const result = await callEnfaUpload(reffld, files, endpoint);

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-url": result.request?.url ?? "",
          "x-sap-method": result.request?.method ?? "",
          "x-sap-request": String(result.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          console.error("[enfa-upload] SAP call failed:", result.status, result.error);
          return new Response(JSON.stringify({ error: result.error ?? "SAP request failed", status: result.status }), {
            status: result.status && result.status >= 400 ? result.status : 502,
            headers,
          });
        }

        const { status, message, enfaNo } = extractResult(result.body ?? "");
        const ok = !status || /^s$/i.test(status) || /success/i.test(message ?? "");
        if (!ok) {
          return new Response(JSON.stringify({ error: message ?? "SAP rejected the upload", status }), {
            status: 502,
            headers,
          });
        }

        return new Response(JSON.stringify({ status, message, enfaNo }), { status: 200, headers });
      },
    },
  },
});
