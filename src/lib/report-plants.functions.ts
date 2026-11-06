import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReportPlant } from "@/lib/sap/report-plants";

/** Plant list for the Reports screen From/To Plant fields. */
export const getReportPlants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ plants: ReportPlant[]; error: string }> => {
    const { assertScreenAccess } = await import("@/lib/user-admin.server");
    try {
      await assertScreenAccess({ supabase: context.supabase, userId: context.userId }, "report");
    } catch {
      return { plants: [], error: "Report permission required" };
    }
    const { callReportPlantF4 } = await import("@/lib/sap-report.server");
    const { parseReportPlants } = await import("@/lib/sap/report-plants");
    const res = await callReportPlantF4();
    if (!res.ok) {
      const raw = res.body?.trim() ?? "";
      return { plants: [], error: raw && !/^<!doctype html|^<html/i.test(raw) ? raw.slice(0, 200) : (res.error ?? "SAP request failed") };
    }
    return { plants: parseReportPlants(res.body), error: "" };
  });
