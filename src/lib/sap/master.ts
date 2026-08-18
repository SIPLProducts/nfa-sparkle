// SAP master-data adapter. Currently returns mock data; swap implementations
// when the customer provides real SAP OData/REST endpoints. The shape of
// every export here is the contract the UI relies on — keep it stable.

export interface Option { code: string; name: string }
export interface PlantOption extends Option { company: string }
export interface ProjectOption extends Option { plant: string }

export const COMPANIES: Option[] = [
  { code: "RIL", name: "Ramky Infrastructure Limited" },
  { code: "REEL", name: "Ramky Enviro Engineers Limited" },
  { code: "REFL", name: "Ramky Estates and Farms Limited" },
  { code: "RPCL", name: "Ramky Pharma City (India) Limited" },
  { code: "RCPL", name: "Ramky Cleantech Services Pvt Ltd" },
  { code: "RESPL", name: "Ramky Enviro Services Pvt Ltd" },
];

export const PLANTS: PlantOption[] = [
  { code: "9000", name: "Ramky Infra - Head Office", company: "RIL" },
  { code: "9064", name: "Ramky Infra - Varthur Project", company: "RIL" },
  { code: "9101", name: "Ramky Enviro - Hyderabad TSDF", company: "REEL" },
  { code: "9102", name: "Ramky Enviro - Chennai Plant", company: "REEL" },
  { code: "9200", name: "Ramky Estates - Bengaluru", company: "REFL" },
  { code: "9300", name: "Ramky Pharma City - Visakhapatnam", company: "RPCL" },
  { code: "9400", name: "Ramky Cleantech - Delhi Ops", company: "RCPL" },
  { code: "9500", name: "Ramky Enviro Services - Mumbai", company: "RESPL" },
];

export const PROJECTS: ProjectOption[] = [
  { code: "P001", name: "Head Office Renovation", plant: "9000" },
  { code: "P002", name: "Varthur Phase 2", plant: "9064" },
  { code: "P003", name: "Hyderabad TSDF Expansion", plant: "9101" },
  { code: "P004", name: "Chennai Plant Upgrade", plant: "9102" },
  { code: "P005", name: "Bengaluru Estates Dev", plant: "9200" },
  { code: "P006", name: "Pharma City Phase 3", plant: "9300" },
];

export const NFA_TYPES: Option[] = [
  { code: "BUDGET_DEVIATION", name: "BUDGET DEVIATION" },
  { code: "SCM_ITEMS", name: "SCM ITEMS" },
  { code: "NFA_DOC", name: "NFA DOCUMENT" },
  { code: "CAPEX", name: "CAPEX APPROVAL" },
];

export const FUNCTIONS: Option[] = [
  { code: "PROJECTS", name: "PROJECTS" },
  { code: "SCM", name: "SCM" },
  { code: "FINANCE", name: "FINANCE" },
  { code: "HR", name: "HR" },
  { code: "IT", name: "IT" },
];

export function plantsFor(company: string) {
  const matched = PLANTS.filter((p) => p.company === company);
  // SAP company codes (BUKRS) differ from the built-in codes; keep plants
  // selectable until a Plant F4 service is wired up.
  return matched.length ? matched : PLANTS;
}

/** Parses SAP's Company F4 response into `{ code, name }` options. */
export function parseCompanyF4(raw: unknown): Option[] {
  let src: unknown = raw;
  if (src && typeof src === "object" && !Array.isArray(src)) {
    const obj = src as Record<string, unknown>;
    const arr = Object.values(obj).find((v) => Array.isArray(v));
    src = arr ?? [];
  }
  if (!Array.isArray(src)) return [];
  const out: Option[] = [];
  for (const row of src) {
    if (!row || typeof row !== "object") continue;
    const lower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) lower[k.trim().toLowerCase()] = v;
    const code = String(lower["bukrs"] ?? lower["cc_code"] ?? "").trim();
    if (!code) continue;
    const name = String(lower["butxt"] ?? lower["name1"] ?? "").trim();
    out.push({ code, name: name || code });
  }
  return out;
}
export function projectsFor(plant: string) {
  return PROJECTS.filter((p) => p.plant === plant);
}
export function plantName(code: string | null | undefined) {
  return PLANTS.find((p) => p.code === code)?.name ?? "";
}
export function nfaTypeName(code: string) {
  return NFA_TYPES.find((t) => t.code === code)?.name ?? code;
}