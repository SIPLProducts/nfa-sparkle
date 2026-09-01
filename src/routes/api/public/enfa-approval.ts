import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/enfa-approval")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaApproval } = await import("@/lib/sap-report.server");

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

        let input: { get_data?: { user_name?: string } } = {};
        try {
          input = (await request.json()) as typeof input;
        } catch {
          /* empty body */
        }
        const userName = String(input.get_data?.user_name ?? "").trim();

        const result = await callEnfaApproval(userName ? { user_name: userName } : undefined);

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
          // Configuration/upstream failures return a clean 200 with an
          // ok:false body so the screen shows an inline notice instead of
          // popping the global error overlay. Real auth failures stay 401.
          console.warn("[enfa-approval] SAP call failed:", result.status, result.error);
          const body = JSON.stringify({
            ok: false,
            message: result.error ?? "SAP worklist unavailable",
          });
          return new Response(body, {
            status: result.status && result.status >= 400 && result.status < 500 ? result.status : 200,
            headers: { ...headers, "content-type": "application/json" },
          });
        }

        // Unwrap a middleware envelope if one slipped through.
        let out = result.body || "[]";
        try {
          const parsed = JSON.parse(out);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
            const inner = (parsed as { body: unknown }).body;
            out = typeof inner === "string" ? inner : JSON.stringify(inner ?? []);
          }
        } catch {
          /* pass SAP's raw body through unchanged */
        }

        return new Response(out, { status: 200, headers });
      },
    },
  },
});
