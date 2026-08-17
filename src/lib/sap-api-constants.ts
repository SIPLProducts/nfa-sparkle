export const SAP_MODULES = ["Common", "MM", "SD", "FI", "PP", "QM", "PM", "HR"] as const;
export const SAP_AUTH_TYPES = [
  { value: "basic", label: "Basic" },
  { value: "bearer", label: "Bearer token" },
  { value: "proxy", label: "Proxy / Middleware" },
  { value: "none", label: "None" },
];
export const SAP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const SAP_API_TYPES = [
  { value: "fetch", label: "fetch (live pass-through)" },
  { value: "sync", label: "sync (scheduled cache)" },
  { value: "push", label: "push (outbound to SAP)" },
];
export const SAP_ENVIRONMENTS = ["DEV", "QUALITY", "PROD"] as const;
export const CONNECTION_MODES = [
  { value: "direct", label: "Direct to SAP" },
  { value: "proxy", label: "Via Proxy Server" },
];
export const DEPLOYMENT_MODES = [
  { value: "lovable_cloud", label: "Lovable Cloud" },
  { value: "on_premise", label: "On-premise" },
  { value: "hybrid", label: "Hybrid" },
];

/* ------------------------- eNFA report wire format ------------------------ */

/** Internal filter key -> exact SAP key (three keys carry a trailing space). */
export const REPORT_WIRE_KEYS: Record<string, string> = {
  plant_from: "plant_from",
  plant_to: "plant_to",
  funct_from: "funct_from",
  funct_to: "funct_to",
  nfano_from: "nfano_from",
  nfano_to: "nfano_to ",
  extra_from: "extra_from",
  extra_to: "extra_to ",
  dat_from: "dat_from",
  dat_to: "dat_to",
  usrid_from: "usrid_from",
  usrid_to: "usrid_to",
  r_proc: "r_proc",
  r_comp: "r_comp ",
  r_reje: "r_reje",
};

/** Wraps a flat 15-key filter object into SAP's `{ report: { ... } }` payload. */
export function wrapReportPayload(flat: Record<string, string>) {
  const report: Record<string, string> = {};
  for (const [k, wire] of Object.entries(REPORT_WIRE_KEYS)) report[wire] = (flat[k] ?? "").toString();
  return { report };
}

/* ------------------------- eNFA create wire format ------------------------ */

/** Exact SAP keys for the Create ENFA service, in payload order. */
export const CREATE_WIRE_KEYS = [
  "CC_code",
  "PSPNR",
  "NAME1",
  "FUNCT",
  "EXTR_TXT",
  "SUBJECT",
  "SCOPE_IMPACT",
  "BUDGET_IMPACT",
  "TIMELINE_IMPACT",
  "TEXT",
] as const;

export interface CreateFile { file_name: string; file: string }

/** Wraps a flat field map + attachments into SAP's `{ create: { ... } }` payload. */
export function wrapCreatePayload(flat: Record<string, unknown>, files: CreateFile[] = []) {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat ?? {})) lower[k.trim().toLowerCase()] = v;
  const create: Record<string, unknown> = {};
  for (const key of CREATE_WIRE_KEYS) create[key] = (lower[key.toLowerCase()] ?? "").toString().trim();
  create["file"] = files.map((f) => ({ file_name: String(f.file_name ?? ""), file: String(f.file ?? "") }));
  return { create };
}
