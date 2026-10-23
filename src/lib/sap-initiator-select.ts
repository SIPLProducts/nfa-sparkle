/**
 * SAP's record Select answers only for the record's initiator. Tries each candidate
 * user (in order, in small batches) and returns the first reply carrying INIT_USERID.
 * Pure apart from the injected select call, so it can be tested.
 */
export async function selectRecordAsInitiator(
  candidates: string[],
  select: (userName: string) => Promise<{ ok: boolean; body: string }>,
  batchSize = 6,
): Promise<Record<string, unknown> | null> {
  const users = Array.from(new Set(candidates.map((u) => u.trim().toUpperCase()).filter(Boolean)));
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = await Promise.all(users.slice(i, i + batchSize).map(async (u) => {
      try {
        const r = await select(u);
        const parsed = r.ok ? JSON.parse(r.body || "null") : null;
        const d = Array.isArray(parsed) ? parsed[0] : parsed;
        return d && typeof d === "object" && String((d as Record<string, unknown>).INIT_USERID ?? "").trim()
          ? d as Record<string, unknown> : null;
      } catch { return null; }
    }));
    const hit = batch.find(Boolean);
    if (hit) return hit;
  }
  return null;
}
