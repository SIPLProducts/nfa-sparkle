export type SeriesRange = { series: string; range_from: number; range_to: number };

/** Series whose From–To range contains the company code; narrowest wins on overlap. */
export function pickCompanySeries(code: string, ranges: SeriesRange[]): string | null {
  const n = Number(String(code ?? "").trim());
  if (!Number.isFinite(n) || !String(code ?? "").trim()) return null;
  const hits = ranges.filter((r) => n >= Number(r.range_from) && n <= Number(r.range_to));
  if (!hits.length) return null;
  hits.sort((a, b) => (a.range_to - a.range_from) - (b.range_to - b.range_from));
  return String(hits[0].series).trim();
}

const ADMIN_KEYS = new Set(["admin", "custom_admin"]);
export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_KEYS.has(String(role ?? "").trim().toLowerCase());
}

export type SeriesUser = { id: string; username: string | null; full_name: string | null; designation: string | null; company_series: string | null; status?: string | null; is_active?: boolean | null };

/** Users in the given series, excluding admins and inactive accounts. */
export function filterSeriesApprovers(series: string | null, users: SeriesUser[], adminIds: Set<string>) {
  if (!series) return [];
  return users.filter((u) =>
    String(u.company_series ?? "").trim() === series &&
    !adminIds.has(u.id) && u.is_active !== false &&
    String(u.status ?? "active").toLowerCase() !== "inactive" &&
    String(u.username ?? "").trim());
}
