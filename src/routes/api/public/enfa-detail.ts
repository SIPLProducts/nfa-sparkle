import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/enfa-detail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaDetail } = await import("@/lib/sap-report.server");

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

        const edit = (input["edit"] ?? {}) as Record<string, unknown>;
        const reffld = String(edit["reffld"] ?? input["reffld"] ?? "").trim();
        if (!reffld) {
          return Response.json({ error: "A record number (reffld) is required" }, { status: 400 });
        }

        let result;
        try {
          result = await callEnfaDetail(reffld, edit);
        } catch (error) {
          const message = error instanceof Error ? error.message : "SAP record details are unavailable";
          console.error("[enfa-detail] request failed:", message);
          return Response.json(
            { ok: false, message },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }

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
          // An unavailable SAP host or middleware is an upstream business-data
          // failure, not an application crash. Return valid JSON so dialogs can
          // show their saved-data fallback instead of the global 502 overlay.
          console.warn("[enfa-detail] SAP call failed:", result.status, result.error);
          let message = result.error ?? "SAP record details are unavailable";
          const raw = result.body.trim();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as unknown;
              if (typeof parsed === "string" && parsed.trim()) message = parsed.trim();
              else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const value = (parsed as Record<string, unknown>)["message"]
                  ?? (parsed as Record<string, unknown>)["error"];
                if (typeof value === "string" && value.trim()) message = value.trim();
              }
            } catch {
              message = raw.slice(0, 500);
            }
          }
          return Response.json(
            { ok: false, message },
            {
              status: result.status && result.status >= 400 && result.status < 500 ? result.status : 200,
              headers,
            },
          );
        }

        // SAP sometimes answers 200 with a plain sentence instead of a record.
        // Always hand the client valid JSON while keeping SAP's exact wording.
        const raw = (result.body ?? "").trim();
        if (!raw) return new Response("{}", { status: 200, headers });
        try {
          JSON.parse(raw);
          return new Response(raw, { status: 200, headers });
        } catch {
          return new Response(JSON.stringify({ message: raw }), { status: 200, headers });
        }
      },

    },
  },
});
