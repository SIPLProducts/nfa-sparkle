import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";
import { filterRangeApprovers, isAdminRole, isApproverRole, rangesOverlap, type Range } from "./series-approvers";

/** Budgeted approvers: User Management users sharing the signed-in user's Series, Admins and the caller excluded. */
export const listSeriesApprovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { company: string; plant?: string; series?: string }) => ({ series: String(input?.series ?? "").trim().slice(0, 40), company: String(input?.company ?? "").trim().slice(0, 20), plant: String(input?.plant ?? "").trim().slice(0, 20) }))
  .handler(async ({ data, context }): Promise<{ series: string | null; users: { userId: string; name: string; designation: string }[] }> => {
    await assertScreenAccess(context as any, "nfa_new");
    const db = await admin();
    const callerId = (context as any).userId as string;
    const { data: me, error: mErr } = await db.from("profiles").select("company_series").eq("id", callerId).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    const series = data.series || String((me as any)?.company_series ?? "").trim() || null;
    if (!series) return { series: null, users: [] };
    const { data: ranges, error: rErr } = await db.from("company_series").select("series, range_from, range_to");
    if (rErr) throw new Error(rErr.message);
    const rangeOf = new Map<string, Range>();
    for (const r of (ranges ?? []) as any[]) rangeOf.set(String(r.series ?? "").trim(), { from: Number(r.range_from), to: Number(r.range_to) });
    const target = rangeOf.get(series) ?? null;
    if (!target) return { series, users: [] };
    const overlapping = [...rangeOf].filter(([, r]) => rangesOverlap(target, r)).map(([k]) => k);
    if (!overlapping.length) return { series, users: [] };
    const { data: profs, error } = await db.from("profiles")
      .select("id, username, full_name, designation, company_series, status, is_active").in("company_series", overlapping);
    if (error) throw new Error(error.message);
    const ids = (profs ?? []).map((p: any) => p.id);
    const adminIds = new Set<string>();
    const approverIds = new Set<string>();
    if (ids.length) {
      const [{ data: a }, { data: b }] = await Promise.all([
        db.from("user_role_assignment").select("user_id, role_key").in("user_id", ids),
        db.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      (a ?? []).forEach((r: any) => { if (isAdminRole(r.role_key)) adminIds.add(r.user_id); if (isApproverRole(r.role_key)) approverIds.add(r.user_id); });
      (b ?? []).forEach((r: any) => { if (isAdminRole(r.role)) adminIds.add(r.user_id); if (isApproverRole(r.role)) approverIds.add(r.user_id); });
    }
    const users = filterRangeApprovers(target, (profs ?? []) as any, rangeOf, approverIds, adminIds, callerId)
      .sort((x, y) => String(x.username).localeCompare(String(y.username), undefined, { numeric: true }))
      .map((u) => ({ userId: String(u.username).trim(), name: u.full_name ?? "", designation: u.designation ?? "" }));
    return { series, users };
  });

/** Every configured Series (User Management > Company > Series) for the Budgeted filter, plus the caller's own. */
export const listApproverSeriesOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ series: string[]; labels: Record<string, string>; mine: string | null }> => {
    await assertScreenAccess(context as any, "nfa_new");
    const db = await admin();
    const [{ data: rows, error }, { data: me }] = await Promise.all([
      db.from("company_series").select("series, range_from, range_to"),
      db.from("profiles").select("company_series").eq("id", (context as any).userId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const series: string[] = [...new Set<string>((rows ?? []).map((r: any) => String(r.series ?? "").trim()).filter(Boolean))]
      .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
    const labels: Record<string, string> = {};
    for (const r of (rows ?? []) as any[]) labels[String(r.series ?? "").trim()] = `${r.range_from}–${r.range_to}`;
    series.sort((a, b) => labels[a].localeCompare(labels[b], undefined, { numeric: true }));
    return { series, labels, mine: String((me as any)?.company_series ?? "").trim() || null };
  });
