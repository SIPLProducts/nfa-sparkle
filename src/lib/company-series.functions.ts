import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";
import { cleanSeries, type SeriesInput } from "./company-series";

export interface CompanySeries { id: string; series: string; range_from: number; range_to: number; created_at: string; updated_at: string }

const friendly = (m: string) => (/duplicate|unique/i.test(m) ? "This Series already exists" : m);

export const listCompanySeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanySeries[]> => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { data, error } = await db.from("company_series").select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as CompanySeries[]).sort((a, b) => a.series.localeCompare(b.series, undefined, { numeric: true }));
  });

export const createCompanySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SeriesInput) => cleanSeries(d))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const { error } = await (await admin()).from("company_series").insert(data);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const updateCompanySeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SeriesInput & { id: string }) => ({ id: d.id, item: cleanSeries(d) }))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const { error } = await (await admin()).from("company_series").update(data.item).eq("id", data.id);
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
