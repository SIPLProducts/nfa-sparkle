export type SeriesRange = { series: string; range_from: number; range_to: number };

const num = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return /^\d+$/.test(t) ? Number(t) : null;
};

/** Pick the user's configured Series range: saved series first, else the range containing their company code. */
export function pickSeriesRange(
  userSeries: string | null | undefined,
  userCode: string | null | undefined,
  ranges: SeriesRange[],
): SeriesRange | null {
  const s = (userSeries ?? "").trim();
  if (s) {
    const hit = ranges.find((r) => r.series.trim() === s);
    if (hit) return hit;
  }
  const n = num(userCode) ?? num(userSeries);
  if (n == null) return null;
  return ranges.find((r) => n >= r.range_from && n <= r.range_to) ?? null;
}

export function filterCompaniesByRange<T extends { code: string }>(range: SeriesRange | null, companies: T[]): T[] {
  if (!range) return [];
  return companies
    .filter((c) => {
      const n = num(c.code);
      return n != null && n >= range.range_from && n <= range.range_to;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
