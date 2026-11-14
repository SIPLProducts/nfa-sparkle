import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";
import { filterSeriesApprovers, isAdminRole, pickCompanySeries } from "./series-approvers";

/** Budgeted approvers: User Management users in the selected company's Series, Admins excluded. */
export const listSeriesApprovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { company: string }) => ({ company: String(input?.company ?? "").trim().slice(0, 20) }))
  .handler(async ({ data, context }): Promise<{ series: string | null; users: { userId: string; name: string; designation: string }[] }> => {
    await assertScreenAccess(context as any, "nfa_new");
    const db = await admin();
    const { data: ranges, error: rErr } = await db.from("company_series").select("series, range_from, range_to");
    if (rErr) throw new Error(rErr.message);
    const series = pickCompanySeries(data.company, (ranges ?? []) as any);
    if (!series) return { series: null, users: [] };
    const { data: profs, error } = await db.from("profiles")
      .select("id, username, full_name, designation, company_series, status, is_active").eq("company_series", series);
    if (error) throw new Error(error.message);
    const ids = (profs ?? []).map((p: any) => p.id);
    const adminIds = new Set<string>();
    if (ids.length) {
      const [{ data: a }, { data: b }] = await Promise.all([
        db.from("user_role_assignment").select("user_id, role_key").in("user_id", ids),
        db.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      (a ?? []).forEach((r: any) => isAdminRole(r.role_key) && adminIds.add(r.user_id));
      (b ?? []).forEach((r: any) => isAdminRole(r.role) && adminIds.add(r.user_id));
    }
    const users = filterSeriesApprovers(series, (profs ?? []) as any, adminIds)
      .sort((x, y) => String(x.username).localeCompare(String(y.username), undefined, { numeric: true }))
      .map((u) => ({ userId: String(u.username).trim(), name: u.full_name ?? "", designation: u.designation ?? "" }));
    return { series, users };
  });
