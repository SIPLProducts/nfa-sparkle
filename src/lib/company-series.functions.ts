import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";
import { cleanSeries, type SeriesInput } from "./company-series";

export interface CompanySeries { id: string; series: string; range_from: number; range_to: number; created_at: string; updated_at: string }

const friendly = (m: string) => (/duplicate|unique/i.test(m) ? "This Range already exists" : m);

export const listCompanySeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanySeries[]> => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { data, error } = await db.from("company_series").select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as CompanySeries[]).sort((a, b) => a.range_from - b.range_from || a.range_to - b.range_to);
  });

export const createCompanySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SeriesInput) => cleanSeries(d))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    await assertUniqueRange(db, data.range_from, data.range_to);
    const { error } = await db.from("company_series").insert(data);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const updateCompanySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SeriesInput & { id: string }) => ({ id: d.id, item: cleanSeries(d) }))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    await assertUniqueRange(db, data.item.range_from, data.item.range_to, data.id);
    // Keep the existing internal key so assigned users stay linked.
    const { series: _k, ...item } = data.item;
    const { error } = await db.from("company_series").update(item).eq("id", data.id);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const deleteCompanySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const { error } = await (await admin()).from("company_series").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertUniqueRange(db: any, from: number, to: number, exceptId?: string) {
  const { data } = await db.from("company_series").select("id").eq("range_from", from).eq("range_to", to);
  if ((data ?? []).some((r: any) => r.id !== exceptId)) throw new Error("This Range already exists");
}
