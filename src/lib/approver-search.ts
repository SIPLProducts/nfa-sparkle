/** Case-insensitive partial match of an approver row against a search query. */
export function matchesApproverSearch(
  query: string,
  fields: { userId?: string; name?: string; department?: string; designation?: string },
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fields.userId, fields.name, fields.department, fields.designation]
    .some((v) => (v ?? "").toLowerCase().includes(q));
}
