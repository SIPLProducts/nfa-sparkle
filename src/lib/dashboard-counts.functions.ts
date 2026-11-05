import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardCounts } from "@/lib/sap/dashboard-counts";

/** Live SAP dashboard counts for the signed-in user's portal User ID. */
export const getDashboardCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ counts: DashboardCounts | null; error: string }> => {
    const { assertScreenAccess } = await import("@/lib/user-admin.server");
    try {
      await assertScreenAccess({ supabase: context.supabase, userId: context.userId }, "dashboard");
    } catch {
      return { counts: null, error: "Dashboard permission required" };
    }
    const { data: profile } = await context.supabase.from("profiles").select("username").eq("id", context.userId).maybeSingle();
    const userName = String(profile?.username ?? "").trim();
    if (!userName) return { counts: null, error: "Your user has no User ID saved." };
    const { callDashboardCounts } = await import("@/lib/sap-report.server");
    const { parseDashboardCounts } = await import("@/lib/sap/dashboard-counts");
    const res = await callDashboardCounts(userName);
    if (!res.ok) {
      const raw = res.body?.trim() ?? "";
      return { counts: null, error: raw && !/^<!doctype html|^<html/i.test(raw) ? raw.slice(0, 200) : (res.error ?? "SAP request failed") };
    }
    const counts = parseDashboardCounts(res.body);
    return counts ? { counts, error: "" } : { counts: null, error: "SAP returned no dashboard counts." };
  });
