import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ApprovalPrintContext {
  savedDetail: Record<string, string | number | null> | null;
  initiatorName: string;
  savedComments: Array<{ name: string; text: string; level: number }>;
}

interface SavedApprovalLevel {
  level: number;
  approver_id: string;
  designation: string | null;
  status: string;
  comment: string | null;
  acted_at: string | null;
}

interface SavedPrintProfile {
  id: string;
  full_name: string | null;
  username: string | null;
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
  .inputValidator((input: { enfaNumber: string; screen?: "approvals" | "report" | "nfa_my" }) => ({
    enfaNumber: input.enfaNumber.trim(),
    screen: input.screen === "report" || input.screen === "nfa_my" ? input.screen : "approvals",
  }))
  .handler(async ({ data, context }): Promise<ApprovalPrintContext> => {
    if (!data.enfaNumber) return { savedDetail: null, initiatorName: "", savedComments: [] };

    const { assertScreenAccess, getAdminClient } = await import("@/lib/user-admin.server");
    await assertScreenAccess(context as Parameters<typeof assertScreenAccess>[0], data.screen);
    const db = await getAdminClient();

    const { data: record, error: recordError } = await db
      .from("nfa")
      .select("id, initiator_id, company, plant, plant_name, nfa_type, function, subject, scope_impact, budget_impact, timeline_days, detailed_description, created_at")
      .eq("enfa_number", data.enfaNumber)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (recordError) throw new Error("Unable to load the saved Print Form record");
    if (!record) {
      // SAP-created NFAs: use the initiator and function saved alongside the draft.
      const { data: draft } = await db
        .from("sap_record_draft")
        .select("initiator_id, initiator_name, function_name")
        .eq("enfa_number", data.enfaNumber)
        .maybeSingle();
      const d = draft as { initiator_id: string | null; initiator_name: string | null; function_name: string | null } | null;
      if (!d) return { savedDetail: null, initiatorName: "", savedComments: [] };
      if (data.screen === "nfa_my" && d.initiator_id && d.initiator_id !== context.userId) {
        throw new Error("Forbidden: this Print Form does not belong to you");
      }
      let name = d.initiator_name?.trim() ?? "";
      if (!name && d.initiator_id) {
        const { data: p } = await db.from("profiles").select("full_name").eq("id", d.initiator_id).maybeSingle();
        name = String((p as { full_name?: string | null } | null)?.full_name ?? "").trim();
      }
      const fn = d.function_name?.trim() ?? "";
      return { savedDetail: fn ? { REFFLD: data.enfaNumber, EXTR_TXT: fn } : null, initiatorName: name, savedComments: [] };
    }
    if (data.screen === "nfa_my" && record.initiator_id !== context.userId) {
      throw new Error("Forbidden: this Print Form does not belong to you");
    }

    const { data: levels, error: levelsError } = await db
      .from("nfa_approver")
      .select("level, approver_id, designation, status, comment, acted_at")
      .eq("nfa_id", record.id)
      .order("level", { ascending: true });
    if (levelsError) throw new Error("Unable to load the saved approval levels");
    const savedLevels = (levels ?? []) as SavedApprovalLevel[];
    const profileIds = [record.initiator_id, ...savedLevels.map((level) => level.approver_id)].filter(Boolean);
    const { data: profiles, error: profilesError } = profileIds.length
      ? await db.from("profiles").select("id, full_name, username").in("id", profileIds)
      : { data: [] };
    if (profilesError) throw new Error("Unable to load the saved approver details");
    const savedProfiles = (profiles ?? []) as SavedPrintProfile[];
    const nameById = new Map(savedProfiles.map((profile) => [profile.id, profile.full_name ?? ""]));
    const usernameById = new Map(savedProfiles.map((profile) => [profile.id, profile.username ?? ""]));
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
    for (const level of savedLevels) {
      const acted = formatActionTime(level.acted_at);
      savedDetail[`ROLE${level.level}`] = level.designation ?? "";
      savedDetail[`USERID${level.level}`] = usernameById.get(level.approver_id) ?? "";
      savedDetail[`APPR${level.level}`] = nameById.get(level.approver_id) ?? "";
      savedDetail[`STAT${level.level}`] = level.status ?? "";
      savedDetail[`ACT_DATE${level.level}`] = acted.date;
      savedDetail[`ACT_TIME${level.level}`] = acted.time;
    }

    const savedComments = savedLevels.map((level) => ({
      name: nameById.get(level.approver_id)?.trim() || level.designation?.trim() || "",
      text: level.comment?.trim() ?? "",
      level: level.level,
    }));

    return { savedDetail, initiatorName, savedComments };
  });
/**
 * Read-only: SAP's record Select answers only for the initiator, so an approver's own
 * request comes back empty. Retries as the signed-in user first, then other active
 * portal users, and returns only this record's SAP detail.
 */
export const getInitiatorRecordDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enfaNumber: string; screen?: "approvals" | "report" | "nfa_my" }) => ({
    enfaNumber: String(input.enfaNumber ?? "").trim(),
    screen: input.screen === "report" || input.screen === "nfa_my" ? input.screen : "approvals",
  }))
  .handler(async ({ data, context }): Promise<Record<string, string> | null> => {
    if (!data.enfaNumber) return null;
    const { assertScreenAccess, getAdminClient } = await import("@/lib/user-admin.server");
    await assertScreenAccess(context as Parameters<typeof assertScreenAccess>[0], data.screen);
    const db = await getAdminClient();
    const { data: me } = await db.from("profiles").select("username").eq("id", context.userId).maybeSingle();
    const { data: profs } = await db.from("profiles").select("username, status");
    const all = ((profs ?? []) as Array<{ username: string | null; status: string | null }>)
      .filter((p) => p.username && String(p.status ?? "").toUpperCase() !== "DELETED")
      .map((p) => p.username!);
    const { callEnfaSelect } = await import("@/lib/sap-report.server");
    const { selectRecordAsInitiator } = await import("@/lib/sap-initiator-select");
    const detail = await selectRecordAsInitiator([me?.username ?? "", ...all], (u) => callEnfaSelect(data.enfaNumber, { user_name: u }));
    if (!detail) return null;
    if (data.screen === "nfa_my" && String(detail.INIT_USERID ?? "").trim().toUpperCase() !== String(me?.username ?? "").trim().toUpperCase()) return null;
    const out: Record<string, string> = Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, v == null ? "" : String(v)]));
    // Initiator display name: the portal profile for SAP's INIT_USERID, else SAP's own name/ID.
    const initUser = String(out.INIT_USERID ?? "").trim();
    let initName = "";
    if (initUser) {
      const { data: prof } = await db.from("profiles").select("full_name").ilike("username", initUser).limit(1).maybeSingle();
      initName = String((prof as { full_name?: string | null } | null)?.full_name ?? "").trim();
    }
    out.INIT_DISPLAY_NAME = initName || String(out.INIT_NAME ?? "").trim() || initUser;
    return out;
  });

/** Maps SAP approver User IDs to portal full names (read-only, permission-checked). */
export const resolveApproverNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userIds: string[]; screen?: "approvals" | "report" | "nfa_my" }) => ({
    userIds: Array.from(new Set((input.userIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))).slice(0, 60),
    screen: input.screen === "report" || input.screen === "nfa_my" ? input.screen : "approvals",
  }))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    if (!data.userIds.length) return {};
    const { assertScreenAccess, getAdminClient } = await import("@/lib/user-admin.server");
    await assertScreenAccess(context as Parameters<typeof assertScreenAccess>[0], data.screen);
    const db = await getAdminClient();
    const { data: rows } = await db.from("profiles").select("username, full_name, status");
    const wanted = new Set(data.userIds.map((id) => id.toUpperCase()));
    const out: Record<string, string> = {};
    for (const p of (rows ?? []) as Array<{ username: string | null; full_name: string | null; status: string | null }>) {
      const key = String(p.username ?? "").trim().toUpperCase();
      const name = String(p.full_name ?? "").trim();
      if (key && name && wanted.has(key) && !out[key]) out[key] = name;
    }
    return out;
  });
