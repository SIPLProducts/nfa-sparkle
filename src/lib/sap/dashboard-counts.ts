export interface DashboardCounts {
  pending: number;
  approved: number;
  rejected: number;
  backToInitiator: number;
  clarification: number;
}

export const DASHBOARD_COUNTS_ENDPOINT_NAMES = ["Dashboard Count Api", "%dashboard count%"] as const;

export function buildDashboardCountsPayload(userName: string) {
  return { dashboard: { user_name: String(userName ?? "").trim().toUpperCase() } };
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

/** Maps SAP LV_* counts to the dashboard cards; returns null when the reply has none. */
export function parseDashboardCounts(input: unknown): DashboardCounts | null {
  let v: unknown = input;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (v && typeof v === "object" && !Array.isArray(v) && "body" in v) return parseDashboardCounts((v as { body: unknown }).body);
  if (Array.isArray(v)) v = v[0];
  if (!v || typeof v !== "object") return null;
  const o: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) o[k.toUpperCase()] = val;
  if (!["LV_INP", "LV_COMP", "LV_REJ", "LV_WITH", "LV_REQ"].some((k) => k in o)) return null;
  return {
    pending: num(o["LV_INP"]),
    approved: num(o["LV_COMP"]),
    rejected: num(o["LV_REJ"]),
    backToInitiator: num(o["LV_WITH"]),
    clarification: num(o["LV_REQ"]),
  };
}
