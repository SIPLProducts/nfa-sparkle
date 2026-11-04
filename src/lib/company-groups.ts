export const COMPANY_GROUPS: ReadonlyArray<readonly [number, number]> = [
  [9000, 9499],
  [9500, 9599],
  [1000, 1999],
  [4000, 4199],
];

export function companyGroupFor(code: string | null | undefined): readonly [number, number] | null {
  const t = (code ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return COMPANY_GROUPS.find(([lo, hi]) => n >= lo && n <= hi) ?? null;
}

export function filterCompaniesForUser<T extends { code: string }>(userCode: string | null | undefined, companies: T[]): T[] {
  const g = companyGroupFor(userCode);
  if (!g) return [];
  return companies
    .filter((c) => {
      const t = c.code.trim();
      if (!/^\d+$/.test(t)) return false;
      const n = Number(t);
      return n >= g[0] && n <= g[1];
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
