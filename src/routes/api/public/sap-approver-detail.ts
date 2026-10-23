import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Input = z.object({
  check: z.string().max(2).default(""),
  plant: z.string().trim().min(1).max(40),
  nfaType: z.string().max(80).default(""),
  funct: z.string().max(80).default(""),
});

export const Route = createFileRoute("/api/public/sap-approver-detail")({
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
          await assertScreenAccess({ supabase, userId: String(claimsData.claims.sub) }, "nfa_new");
        } catch {
          return Response.json({ error: "Forbidden: Create NFA permission required" }, { status: 403 });
        }

        let parsed;
        try {
          parsed = Input.parse(await request.json());
        } catch {
          return Response.json({ error: "Plant is required" }, { status: 400 });
        }

        const { callApproverGetDetail } = await import("@/lib/sap-report.server");
        const result = await callApproverGetDetail(parsed);
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
