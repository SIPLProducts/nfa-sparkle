import { createFileRoute } from "@tanstack/react-router";
import { parseSapLogoResponse } from "@/lib/sap-logo";

export const Route = createFileRoute("/api/public/sap-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        if (!url || !key) return Response.json({ error: "Server is not configured for authentication" }, { status: 500 });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
        }

        let companyCode = "";
        try {
          const input = (await request.json()) as Record<string, unknown>;
          companyCode = String(input["companyCode"] ?? "").trim();
        } catch {
          return Response.json({ error: "A Company Code is required" }, { status: 400 });
        }
        if (!/^[A-Za-z0-9_-]{1,20}$/.test(companyCode)) {
          return Response.json({ error: "A valid Company Code is required" }, { status: 400 });
        }

        try {
          const { callSapCompanyLogo } = await import("@/lib/sap-report.server");
          const result = await callSapCompanyLogo(companyCode);
          if (!result.ok) {
            return Response.json(
              { ok: false, message: result.error || result.body || "The company logo is unavailable" },
              { status: 200, headers: { "cache-control": "private, no-store" } },
            );
          }
          return Response.json(
            { ok: true, dataUrl: parseSapLogoResponse(result.body) },
            { headers: { "cache-control": "private, no-store" } },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "The company logo is unavailable";
          console.warn("[sap-logo] request failed:", message);
          return Response.json({ ok: false, message }, { status: 200, headers: { "cache-control": "private, no-store" } });
        }
      },
    },
  },
});
