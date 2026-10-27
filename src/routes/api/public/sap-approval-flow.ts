import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseSapApprovalFlow } from "@/lib/sap-approval-flow";

const InputSchema = z.object({
  plant: z.string().trim().min(1).max(40),
  nfaType: z.string().trim().min(1).max(120),
  functionName: z.string().trim().min(1).max(120),
  enfaNo: z.string().trim().max(40).optional(),
});

export const Route = createFileRoute("/api/public/sap-approval-flow")({
  server: { handlers: { POST: async ({ request }) => {
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return Response.json({ error: "Unauthorized: no session token was sent" }, { status: 401 });
    const token = authHeader.slice(7).trim();
    if (token.split(".").length !== 3) return Response.json({ error: "Unauthorized: malformed session token" }, { status: 401 });
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return Response.json({ error: "Server is not configured for authentication" }, { status: 500 });
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
    let input: z.infer<typeof InputSchema>;
    try { input = InputSchema.parse(await request.json()); }
    catch { return Response.json({ error: "Plant, NFA Type, and Function are required" }, { status: 400 }); }
    try {
      const { callSapApprovalFlow } = await import("@/lib/sap-report.server");
      // Dynamic records (saved at creation) ask SAP by ENFA number only; others use the predefined lookup.
      let dynamic = false;
      if (input.enfaNo) {
        // Read as the signed-in user first (works without the service key), then the admin client.
        const readMode = async (db: any) => {
          const { data, error } = await db.from("sap_record_draft").select("approver_mode").eq("enfa_number", input.enfaNo).maybeSingle();
          if (error) throw error;
          return String(data?.approver_mode ?? "");
        };
        let mode = "";
        try { mode = await readMode(supabase); } catch { /* try admin */ }
        if (!mode) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            mode = await readMode(supabaseAdmin);
          } catch (e) { console.warn("[sap-approval-flow] approver mode lookup failed:", (e as Error)?.message ?? e); }
        }
        dynamic = mode === "dynamic";
      }
      let result = await callSapApprovalFlow({ ...input, check: dynamic ? "" : "X" });
      if (dynamic && (!result.ok || !parseSapApprovalFlow(result.body).length)) {
        result = await callSapApprovalFlow({ ...input, check: "X" });
      }
      if (!result.ok) return Response.json(
        { ok: false, message: result.error || result.body || "The SAP approval flow is unavailable" },
        { status: 200, headers: { "cache-control": "private, no-store" } },
      );
      return Response.json(
        { ok: true, approvers: parseSapApprovalFlow(result.body) },
        { headers: { "cache-control": "private, no-store", "x-sap-url": result.request?.url ?? "", "x-sap-method": result.request?.method ?? "", "x-sap-request": String(result.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000) } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The SAP approval flow is unavailable";
      console.warn("[sap-approval-flow] request failed:", message);
      return Response.json({ ok: false, message }, { status: 200, headers: { "cache-control": "private, no-store" } });
    }
  } } },
});