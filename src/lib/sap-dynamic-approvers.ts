/** SAP API Settings name for the User Management dynamic approvers list. */
export const DYNAMIC_APPROVERS_LIST_ENDPOINT = "Dynamic Approvers List";
export const DYNAMIC_APPROVER_SLOTS = 15;

export interface DynamicApproverLevel { level: number; designation: string; userId: string }
export interface DynamicApproverRecord { nfaNo: string; levels: DynamicApproverLevel[] }

/** Blank = all NFAs; an NFA number = that NFA only. */
export function buildDynamicApproversListPayload(nfaNo = "") {
  return { dynamic_approvers: String(nfaNo ?? "").trim() };
}

function pick(row: Record<string, unknown>, key: string) {
  const hit = Object.keys(row).find((k) => k.trim().toUpperCase() === key);
  return hit ? String(row[hit] ?? "").trim() : "";
}

/** Turns SAP rows into one record per REFFLD with filled levels only. */
export function parseDynamicApprovers(raw: unknown): DynamicApproverRecord[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = (data as any).body ?? (data as any).data ?? (data as any).items;
    data = inner ?? [data];
  }
  if (!Array.isArray(data)) return [];
  const out: DynamicApproverRecord[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const nfaNo = pick(r, "REFFLD");
    const levels: DynamicApproverLevel[] = [];
    for (let i = 1; i <= DYNAMIC_APPROVER_SLOTS; i++) {
      const designation = pick(r, `DESIG${i}`);
      const userId = pick(r, `USERID${i}`);
      if (designation || userId) levels.push({ level: i, designation, userId });
    }
    if (nfaNo || levels.length) out.push({ nfaNo, levels });
  }
  return out;
}

/** User IDs per level (index = level-1) for one ENFA from the dynamic list; [] when none. */
export function dynamicChainIds(records: DynamicApproverRecord[], enfaNo: string): string[] {
  const want = String(enfaNo ?? "").trim().replace(/^0+/, "");
  const rec = records.find((r) => r.nfaNo.replace(/^0+/, "") === want && want);
  if (!rec) return [];
  const out: string[] = [];
  for (const l of rec.levels) if (l.level >= 1 && l.level <= DYNAMIC_APPROVER_SLOTS) out[l.level - 1] = l.userId.trim();
  const ids = Array.from({ length: out.length }, (_, i) => out[i] ?? "");
  return ids.some(Boolean) ? ids : [];
}
