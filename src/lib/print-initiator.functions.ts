import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ApprovalPrintContext {
  savedDetail: Record<string, string | number | null> | null;
  initiatorName: string;
}

function formatActionTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  return {
    date: parsed.toLocaleDateString("en-GB"),
    time: parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

/** Returns the creator's display name from application-owned records only. */
export const getPrintInitiator = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enfaNumber: string }) => ({
    enfaNumber: input.enfaNumber.trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.enfaNumber) return "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record } = await supabaseAdmin
      .from("nfa")
      .select("initiator_id")
      .eq("enfa_number", data.enfaNumber)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let creatorId = record?.initiator_id ?? "";
    if (!creatorId) {
      const { data: workingDocument } = await supabaseAdmin
        .from("enfa_working_document")
        .select("created_by")
        .eq("enfa_number", data.enfaNumber)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      creatorId = workingDocument?.created_by ?? "";
    }
    if (!creatorId) return "";

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", creatorId)
      .maybeSingle();
    return profile?.full_name?.trim() ?? "";
  });

/** Returns the original saved NFA and every ordered approval level as Print Form fallbacks. */
export const getApprovalPrintContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enfaNumber: string }) => ({
    enfaNumber: input.enfaNumber.trim(),
  }))
  .handler(async ({ data, context }): Promise<ApprovalPrintContext> => {
    if (!data.enfaNumber) return { savedDetail: null, initiatorName: "" };

    const { assertScreenAccess, getAdminClient } = await import("@/lib/user-admin.server");
    await assertScreenAccess(context as Parameters<typeof assertScreenAccess>[0], "approvals");
    const db = await getAdminClient();

    const { data: record, error: recordError } = await db
      .from("nfa")
      .select("id, initiator_id, company, plant, plant_name, nfa_type, function, subject, scope_impact, budget_impact, timeline_days, detailed_description, created_at")
      .eq("enfa_number", data.enfaNumber)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (recordError) throw new Error("Unable to load the saved Print Form record");
    if (!record) return { savedDetail: null, initiatorName: "" };

    const { data: levels, error: levelsError } = await db
      .from("nfa_approver")
      .select("level, approver_id, designation, status, acted_at")
      .eq("nfa_id", record.id)
      .order("level", { ascending: true });
    if (levelsError) throw new Error("Unable to load the saved approval levels");
    const profileIds = [record.initiator_id, ...(levels ?? []).map((level) => level.approver_id)].filter(Boolean);
    const { data: profiles, error: profilesError } = profileIds.length
      ? await db.from("profiles").select("id, full_name, username").in("id", profileIds)
      : { data: [] };
    if (profilesError) throw new Error("Unable to load the saved approver details");
    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? ""]));
    const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username ?? ""]));
    const initiatorName = nameById.get(record.initiator_id)?.trim() ?? "";
    const savedDetail: Record<string, string | number | null> = {
      REFFLD: data.enfaNumber,
      CC_CODE: record.company,
      PSPNR: record.plant,
      NAME1: record.plant_name,
      CREATED_AT: record.created_at,
      FUNCT: record.nfa_type,
      EXTR_TXT: record.function,
      SUBJECT: record.subject,
      SCOPE_IMPACT: record.scope_impact,
      BUDGET_IMPACT: record.budget_impact,
      TIMELINE_DAYS: record.timeline_days,
      DETAILED_DESCRIPTION: record.detailed_description,
    };
    for (const level of levels ?? []) {
      const acted = formatActionTime(level.acted_at);
      savedDetail[`ROLE${level.level}`] = level.designation ?? "";
      savedDetail[`USERID${level.level}`] = usernameById.get(level.approver_id) ?? "";
      savedDetail[`APPR${level.level}`] = nameById.get(level.approver_id) ?? "";
      savedDetail[`STAT${level.level}`] = level.status ?? "";
      savedDetail[`ACT_DATE${level.level}`] = acted.date;
      savedDetail[`ACT_TIME${level.level}`] = acted.time;
    }

    return { savedDetail, initiatorName };
  });