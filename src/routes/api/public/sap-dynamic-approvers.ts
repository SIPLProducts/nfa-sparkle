import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Input = z.object({ nfaNo: z.string().trim().max(20).regex(/^[A-Za-z0-9_-]*$/).default("") });

export const Route = createFileRoute("/api/public/sap-dynamic-approvers")({
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
          const { assertScreenAccess } = await import("@/lib/user-admin.server");
          await assertScreenAccess({ supabase, userId: String(claimsData.claims.sub) }, "user_management");
        } catch {
          return Response.json({ error: "Forbidden: User Management permission required" }, { status: 403 });
        }

        let parsed;
        try {
          parsed = Input.parse(await request.json().catch(() => ({})));
        } catch {
          return Response.json({ error: "Enter a valid NFA number" }, { status: 400 });
        }

        const { callDynamicApproversList } = await import("@/lib/sap-report.server");
        const result = await callDynamicApproversList(parsed.nfaNo);
        const headers = { "cache-control": "no-store" };
        if (!result.ok) {
          const raw = result.body?.trim() ?? "";
          const detail = raw && !/^<!doctype html|^<html/i.test(raw) ? raw.slice(0, 300) : (result.error ?? "SAP request failed");
          return Response.json({ error: detail }, { status: 424, headers });
        }
        const { parseDynamicApprovers } = await import("@/lib/sap-dynamic-approvers");
        const body = result.body ?? "";
        const records = parseDynamicApprovers(body);
        let message = "";
        if (!records.length) {
          try { const p = JSON.parse(body); message = typeof p === "object" && p ? String((p as any).message ?? (p as any).MESSAGE ?? "") : String(p); }
          catch { message = body.trim().slice(0, 300); }
        }
        return Response.json({ records, message }, { headers });
      },
    },
  },
});
