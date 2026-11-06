/** Copies looked-up portal names onto approvers (matched by User ID, case-insensitive), keeping any existing name. */
export function withApproverNames<T extends { userId: string; name?: string }>(
  approvers: T[],
  details: Record<string, { name?: string } | undefined>,
): T[] {
  const byId = new Map<string, string>();
  for (const [id, d] of Object.entries(details ?? {})) {
    const n = String(d?.name ?? "").trim();
    if (n) byId.set(id.trim().toLowerCase(), n);
  }
  return approvers.map((a) => {
    if (String(a.name ?? "").trim()) return a;
    return { ...a, name: byId.get(String(a.userId ?? "").trim().toLowerCase()) ?? "" };
  });
}
