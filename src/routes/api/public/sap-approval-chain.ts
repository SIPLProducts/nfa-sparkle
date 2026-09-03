import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sap-approval-chain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callApprovalChain } = await import("@/lib/sap-report.server");

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

        let input: { approver?: string } = {};
        try {
          input = (await request.json()) as typeof input;
        } catch {
          /* empty body */
        }

        let result;
        try {
          result = await callApprovalChain(String(input.approver ?? "").trim());
        } catch (error) {
          const message = error instanceof Error ? error.message : "Approval chain service failed";
          return Response.json(
            { error: `Could not load approval chains from SAP: ${message}` },
            { status: 424, headers: { "cache-control": "no-store" } },
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
          return Response.json({ error: detail, sapStatus: result.status }, { status: 424, headers });
        }

        let out = result.body || "[]";
        try {
          const parsed = JSON.parse(out);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
            const inner = (parsed as { body: unknown }).body;
            out = typeof inner === "string" ? inner : JSON.stringify(inner ?? []);
          }
        } catch {
          /* plain-text reply — wrap it below */
        }

        try {
          JSON.parse(out);
        } catch {
          out = JSON.stringify({ message: out.trim() });
        }

        return new Response(out, { status: 200, headers });
      },
    },
  },
});
