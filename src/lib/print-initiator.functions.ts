import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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