import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sap-function")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callSapFunctionF4 } = await import("@/lib/sap-report.server");

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

        try {
          const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
          if (claimsErr || !claimsData?.claims?.sub) {
            return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
          }
        } catch {
          return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
        }

        let result;
        try {
          let nfaType = "";
          try {
            const payload = (await request.json()) as Record<string, unknown> | null;
            nfaType = String(payload?.["nfaType"] ?? payload?.["nfa_typ1"] ?? "").trim();
          } catch {
            nfaType = "";
          }
          result = await callSapFunctionF4(nfaType);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Function service failed";
          return Response.json(
            { error: `Could not load functions from SAP: ${message}` },
            { status: 424, headers: { "cache-control": "no-store" } },
          );
        }

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          const rawBody = result.body?.trim() ?? "";
          const isHtml = /^<!doctype html|^<html/i.test(rawBody);
          let detail = result.error ?? "SAP request failed";
          if (!isHtml && rawBody) {
            try {
              const parsed = JSON.parse(rawBody) as Record<string, unknown>;
              detail = String(parsed["error"] ?? parsed["MESSAGE"] ?? parsed["message"] ?? detail);
            } catch {
              detail = rawBody.slice(0, 300);
            }
          } else if (isHtml) {
            detail = "The SAP middleware gateway is temporarily unavailable. Please retry.";
          }
          return Response.json(
            { error: detail, sapStatus: result.status },
            { status: 424, headers },
          );
        }

        let out = result.body || "{}";
        try {
          const parsed = JSON.parse(out);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
            const inner = (parsed as { body: unknown }).body;
            out = typeof inner === "string" ? inner : JSON.stringify(inner ?? {});
          }
        } catch {
          /* pass SAP's raw body through unchanged */
        }

        return new Response(out, { status: 200, headers });
      },
    },
  },
});
