import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Input = z.object({
  plants: z.array(z.string().trim().min(1).max(40)).min(1).max(2000),
});
const ListInput = z.object({ nfaNo: z.string().trim().max(40).optional() });

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
        const rawBody: unknown = await request.json().catch(() => ({}));
        // Requests without `plants` come from User Management's Dynamic Approvers list.
        const isList = !(rawBody && typeof rawBody === "object" && "plants" in rawBody);
        try {
          const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
          if (claimsErr || !claimsData?.claims?.sub) {
            return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
          }
          const { assertScreenAccess } = await import("@/lib/user-admin.server");
          await assertScreenAccess({ supabase, userId: String(claimsData.claims.sub) }, isList ? "user_management" : "nfa_new");
        } catch {
          return Response.json(
            { error: isList ? "Forbidden: User Management permission required" : "Forbidden: Create NFA permission required" },
            { status: 403 },
          );
        }

        if (isList) {
          const listInput = ListInput.safeParse(rawBody);
          if (!listInput.success) return Response.json({ error: "Invalid NFA number" }, { status: 400 });
          const { callDynamicApproversList } = await import("@/lib/sap-report.server");
          const { parseDynamicApprovers } = await import("@/lib/sap-dynamic-approvers");
          const r = await callDynamicApproversList(listInput.data.nfaNo ?? "");
          if (!r.ok) {
            const raw = r.body?.trim() ?? "";
            const detail = raw && !/^<!doctype html|^<html/i.test(raw) ? raw.slice(0, 300) : (r.error ?? "SAP request failed");
            return Response.json({ error: detail }, { status: 424 });
          }
          const records = parseDynamicApprovers(r.body ?? "");
          let message = "";
          if (!records.length) {
            try {
              const j = JSON.parse(r.body ?? "");
              message = typeof j?.message === "string" ? j.message : "";
            } catch {
              message = (r.body ?? "").trim().slice(0, 300);
            }
          }
          return Response.json({ records, message }, { headers: { "cache-control": "no-store" } });
        }

        let parsed;
        try {
          parsed = Input.parse(rawBody);
        } catch {
          return Response.json({ error: "At least one plant is required" }, { status: 400 });
        }

        const { callDynamicApprovers } = await import("@/lib/sap-report.server");
        const result = await callDynamicApprovers(parsed);
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-url": result.request?.url ?? "",
          "x-sap-method": result.request?.method ?? "",
          "x-sap-request": String(result.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000),
        };
        if (!result.ok) {
          const raw = result.body?.trim() ?? "";
          const detail = raw && !/^<!doctype html|^<html/i.test(raw) ? raw.slice(0, 300) : (result.error ?? "SAP request failed");
          return Response.json({ error: detail }, { status: 424, headers });
        }
        let out = result.body || "[]";
        try {
          const p = JSON.parse(out);
          if (p && typeof p === "object" && !Array.isArray(p) && "body" in p) {
            const inner = (p as { body: unknown }).body;
            out = typeof inner === "string" ? inner : JSON.stringify(inner ?? []);
          }
          JSON.parse(out);
        } catch {
          out = JSON.stringify({ message: out.trim() });
        }
        return new Response(out, { status: 200, headers });
      },
    },
  },
});
