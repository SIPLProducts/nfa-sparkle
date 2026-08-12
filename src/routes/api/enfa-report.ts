import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/enfa-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { buildReportPayload, callEnfaReport } = await import("@/lib/sap-report.server");

        // Authenticate the caller with the bearer token from the browser session.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input: any, init: any) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let input: unknown = {};
        try {
          input = await request.json();
        } catch {
          input = {};
        }

        const payload = buildReportPayload(input);
        const result = await callEnfaReport(payload);

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          return new Response(
            result.body && result.body.trim()
              ? result.body
              : JSON.stringify({ error: result.error ?? "SAP request failed" }),
            { status: result.status && result.status >= 400 ? result.status : 502, headers },
          );
        }

        return new Response(result.body || "[]", { status: 200, headers });
      },
    },
  },
});
