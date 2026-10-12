import { createFileRoute } from "@tanstack/react-router";
import { safeApprovalDetailMessage } from "@/lib/approval-print-document";
import { z } from "zod";

export const Route = createFileRoute("/api/public/enfa-select")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaSelect } = await import("@/lib/sap-report.server");

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

        let reffld: string;
        try {
          const input = z.object({
            edit: z.object({ reffld: z.string().trim().min(1).max(100).optional(), user_name: z.string().max(100).optional() }).optional(),
            reffld: z.string().trim().min(1).max(100).optional(),
          }).parse(await request.json());
          reffld = input.edit?.reffld ?? input.reffld ?? "";
        } catch {
          return Response.json({ error: "A valid record number (reffld) is required" }, { status: 400 });
        }
        if (!reffld) {
          return Response.json({ error: "A record number (reffld) is required" }, { status: 400 });
        }
        // Edit identity is the authenticated portal user, never a caller-supplied
        // sample value or the SAP service account used for Basic authentication.
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("username").eq("id", claimsData.claims.sub).maybeSingle();
        const userName = profile?.username?.trim().toUpperCase() ?? "";
        if (profileError || !userName) {
          return Response.json({ error: "Your User ID could not be resolved. Please sign in again or contact your administrator." }, { status: 400 });
        }
        const result = await callEnfaSelect(reffld, { user_name: userName });

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
          console.error("[enfa-select] SAP call failed:", result.status, result.error);
          let message = safeApprovalDetailMessage(result.error);
          const raw = result.body.trim();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as unknown;
              if (typeof parsed === "string") message = safeApprovalDetailMessage(parsed);
              else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const value = (parsed as Record<string, unknown>)["message"]
                  ?? (parsed as Record<string, unknown>)["error"];
                if (value) message = safeApprovalDetailMessage(value);
              }
            } catch {
              message = safeApprovalDetailMessage(raw);
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

        return new Response(result.body || "{}", { status: 200, headers });
      },
    },
  },
});
