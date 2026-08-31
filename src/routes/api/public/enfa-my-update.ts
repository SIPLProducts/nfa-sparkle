import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/enfa-my-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaMyNfaUpdate } = await import("@/lib/sap-report.server");

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

        let input: Record<string, unknown> = {};
        try {
          input = (await request.json()) as Record<string, unknown>;
        } catch {
          input = {};
        }

        const result = await callEnfaMyNfaUpdate(input);

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
          console.error("[enfa-my-update] SAP call failed:", result.status, result.error);
          return new Response(
            result.body && result.body.trim()
              ? result.body
              : JSON.stringify({ error: result.error ?? "SAP request failed" }),
            { status: result.status && result.status >= 400 ? result.status : 502, headers },
          );
        }

        return new Response(result.body || "{}", { status: 200, headers });
      },
    },
  },
});
