import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";
import { filterCompaniesForUser } from "./company-groups";

export const listMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ code: string; name: string }[]> => {
    await assertScreenAccess(context as any, "nfa_new");
    const db = await admin();
    const { data: prof } = await db.from("profiles").select("company_code").eq("id", context.userId).maybeSingle();
    const { data: rows, error } = await db.from("companies").select("code,name,is_active").eq("is_active", true);
    if (error) throw new Error(error.message);
    const list = (rows ?? [])
      .filter((r: any) => (r.code ?? "").trim())
      .map((r: any) => ({ code: String(r.code).trim(), name: String(r.name) }));
    return filterCompaniesForUser((prof as any)?.company_code ?? null, list);
  });
