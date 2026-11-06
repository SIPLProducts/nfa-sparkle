/** Reports screen Plant F4 helpers (pure, client-safe). */
export const REPORT_PLANT_ENDPOINT_NAMES = ["F4 In Reports Plant Field", "Reports Plant F4"];

export type ReportPlant = { code: string; name: string };

export function buildReportPlantPayload(): { plant: string } {
  return { plant: "" };
}

export function parseReportPlants(json: unknown): ReportPlant[] {
  let data: unknown = json;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (data && !Array.isArray(data) && typeof data === "object") {
    const o = data as Record<string, unknown>;
    data = o.body ?? o.data ?? o.result ?? Object.values(o).find(Array.isArray) ?? [];
    if (typeof data === "string") return parseReportPlants(data);
  }
  if (!Array.isArray(data)) return [];
  const map = new Map<string, ReportPlant>();
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const code = String(r.WERKS ?? r.werks ?? "").trim();
    if (!code || map.has(code)) continue;
    map.set(code, { code, name: String(r.NAME1 ?? r.name1 ?? "").trim() });
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
