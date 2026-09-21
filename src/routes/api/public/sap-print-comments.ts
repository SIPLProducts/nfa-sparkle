import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseSapPrintComments } from "@/lib/print-comment-history";

const InputSchema = z.object({ enfaNumber: z.string().trim().min(1).max(40) });

export const Route = createFileRoute("/api/public/sap-print-comments")({
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
    catch { return Response.json({ error: "An eNFA number is required" }, { status: 400 }); }
    try {
      const { callSapPrintComments } = await import("@/lib/sap-report.server");
      const result = await callSapPrintComments(input.enfaNumber);
      if (!result.ok) return Response.json(
        { ok: false, message: result.error || result.body || "Print Form comments are unavailable" },
        { status: 200, headers: { "cache-control": "private, no-store" } },
      );
      return Response.json(
        { ok: true, comments: parseSapPrintComments(result.body) },
        { headers: { "cache-control": "private, no-store", "x-sap-url": result.request?.url ?? "", "x-sap-method": result.request?.method ?? "", "x-sap-request": String(result.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000) } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Print Form comments are unavailable";
      console.warn("[sap-print-comments] request failed:", message);
      return Response.json({ ok: false, message }, { status: 200, headers: { "cache-control": "private, no-store" } });
    }
  } } },
});