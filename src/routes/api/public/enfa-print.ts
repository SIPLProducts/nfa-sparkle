import { createFileRoute } from "@tanstack/react-router";

const B64 = /^[A-Za-z0-9+/\r\n=]+$/;

/** Finds the base64 document inside whatever shape SAP / the middleware returns. */
function extractBase64(raw: string): { base64: string | null; message: string | null } {
  const text = (raw ?? "").trim();
  if (!text) return { base64: null, message: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Bare base64 string body
    return { base64: text.length > 100 && B64.test(text) ? text : null, message: null };
  }

  let message: string | null = null;
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (typeof node === "string") {
      const s = node.trim();
      return s.length > 100 && B64.test(s) ? s : null;
    }
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item);
        if (hit) return hit;
      }
      return null;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === "string" && /message|msg|error|status/i.test(k) && v.trim() && !message) {
        message = v.trim();
      }
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };

  return { base64: walk(parsed), message };
}

export const Route = createFileRoute("/api/public/enfa-print")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaPrint } = await import("@/lib/sap-report.server");

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
        const print = (input["PRINT"] ?? input["print"] ?? {}) as Record<string, unknown>;
        const enfaNo = String(print["EFNA_NO"] ?? print["efna_no"] ?? input["enfa_no"] ?? "").trim();
        if (!enfaNo) {
          return Response.json({ error: "An eNFA number is required" }, { status: 400 });
        }

        const variantRaw = String(input["variant"] ?? "").toLowerCase();
        const variant = variantRaw === "edit" ? "edit" : undefined;
        const result = await callEnfaPrint(enfaNo, variant);

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          console.error("[enfa-print] SAP call failed:", result.status, result.error);
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
            body = typeof inner === "string" ? inner : JSON.stringify(inner ?? "");
          }
        } catch {
          /* raw body */
        }

        const { base64, message } = extractBase64(body);
        if (!base64) {
          return new Response(
            JSON.stringify({ error: message ?? "SAP did not return a document for this eNFA number." }),
            { status: 200, headers },
          );
        }

        return new Response(
          JSON.stringify({
            status: result.status,
            latencyMs: result.latencyMs,
            base64: base64.replace(/\s+/g, ""),
            mime: "application/pdf",
            filename: `ENFA-${enfaNo}.pdf`,
          }),
          { status: 200, headers },
        );
      },
    },
  },
});