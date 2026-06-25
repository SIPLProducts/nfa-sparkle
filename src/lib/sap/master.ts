// SAP master-data adapter. Currently returns mock data; swap implementations
// when the customer provides real SAP OData/REST endpoints. The shape of
// every export here is the contract the UI relies on — keep it stable.

export interface Option { code: string; name: string }
export interface PlantOption extends Option { company: string }
export interface ProjectOption extends Option { plant: string }

export const COMPANIES: Option[] = [
  { code: "REFL", name: "REFL - Reliance" },
  { code: "ACME", name: "ACME Corp" },
  { code: "TATA", name: "TATA Industries" },
];

export const PLANTS: PlantOption[] = [
  { code: "9000", name: "REFL - Head Office", company: "REFL" },
  { code: "9064", name: "REFL - Varthur Project", company: "REFL" },
  { code: "9001", name: "ACME - Plant 1", company: "ACME" },
  { code: "9200", name: "TATA - Jamshedpur", company: "TATA" },
];

export const PROJECTS: ProjectOption[] = [
  { code: "P001", name: "Head Office Renovation", plant: "9000" },
  { code: "P002", name: "Varthur Phase 2", plant: "9064" },
  { code: "P003", name: "ACME Expansion", plant: "9001" },
  { code: "P004", name: "Jamshedpur Upgrade", plant: "9200" },
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
  return PLANTS.filter((p) => p.company === company);
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