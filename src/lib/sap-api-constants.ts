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
  r_comp: "r_comp",
  r_reje: "r_reje",
  r_init: "r_init",
  r_clar: "r_clar",
};

/**
 * Wraps a flat filter object into SAP's `{ report: { ... } }` payload.
 * `user_name` is emitted first when provided (the server fills it in).
 */
export function wrapReportPayload(flat: Record<string, string>, userName?: string) {
  const report: Record<string, string> = {};
  if (userName !== undefined) report["user_name"] = userName;
  for (const [k, wire] of Object.entries(REPORT_WIRE_KEYS)) report[wire] = (flat[k] ?? "").toString();
  return { report };
}

/* ------------------------- eNFA create wire format ------------------------ */

/** Exact SAP keys for the Create ENFA service, in payload order. */
export const CREATE_WIRE_KEYS = [
  "user_name",
  "CC_code",
  "PSPNR",
  "NAME1",
  "FUNCT",
  "EXTR_TXT",
  "SUBJECT",
  "SCOPE_IMPACT",
  "BUDGET_IMPACT",
  "TIMELINE_IMPACT",
] as const;

export interface CreateFile { file_name: string; file: string }
export interface CreateApprover { designation: string; userId: string }

/** Minimum approvers the initiator must select on Create NFA. */
export const MIN_CREATE_APPROVERS = 2;

/** Maximum approver slots SAP accepts on Create ENFA. */
export const CREATE_APPROVER_SLOTS = 15;

/** Approver mode -> SAP `check` flag: Predefined = "X", Dynamic = "". */
export function approverModeCheck(mode: string | undefined): string {
  return mode === "dynamic" ? "" : mode === "predefined" ? "X" : "";
}

/** API Settings names tried, in order, for the Create NFA approver lookup. */
export const APPROVER_DETAIL_ENDPOINT_NAMES = ["Dynamic Approvals", "Approver Get Detail", "%approvals in create%", "%dynamic approval%", "%get detail%"] as const;

/** Approver mode -> `check` for the get_detail lookup: Predefined = "X", Dynamic = " ". */
export function approverDetailCheck(mode: string | undefined): string {
  return mode === "predefined" ? "X" : " ";
}

/** SAP "get_detail" body used to load approvers on Create NFA. */
export function buildApproverGetDetailPayload(check: string, plant: string, nfaType = "", funct = "") {
  return {
    get_detail: {
      check: check === "X" ? "X" : " ",
      plant: String(plant ?? "").trim(),
      nfa_type: String(nfaType ?? "").trim(),
      funct: String(funct ?? "").trim(),
    },
  };
}

/** Fills design1..15 / approve1..15 in order; unused slots are blank. */
export function buildCreateApproverSlots(approvers: CreateApprover[] = []) {
  if (approvers.length > CREATE_APPROVER_SLOTS) {
    throw new Error(`At most ${CREATE_APPROVER_SLOTS} approvers are allowed`);
  }
  const out: Record<string, string> = {};
  for (let i = 1; i <= CREATE_APPROVER_SLOTS; i++) {
    const a = approvers[i - 1];
    out[`design${i}`] = String(a?.designation ?? "").trim();
    out[`approve${i}`] = String(a?.userId ?? "").trim().toUpperCase();
  }
  return out;
}

/**
 * Wraps a flat field map + attachments into SAP's `{ create: { ... } }` payload.
 * `userName` (the logged-in User ID) overrides any `user_name` in `flat`.
 * When `approvers`/`check` are supplied they are added as SAP's approver slots and mode flag.
 */
export function wrapCreatePayload(
  flat: Record<string, unknown>,
  files: CreateFile[] = [],
  userName?: string,
  extra?: { approvers?: CreateApprover[]; check?: string },
) {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat ?? {})) lower[k.trim().toLowerCase()] = v;
  if (userName) lower["user_name"] = userName;
  const create: Record<string, unknown> = {};
  if (extra) Object.assign(create, buildCreateApproverSlots(extra.approvers ?? []));
  for (const key of CREATE_WIRE_KEYS) create[key] = (lower[key.toLowerCase()] ?? "").toString().trim();
  create["file"] = files.map((f) => ({ file_name: String(f.file_name ?? ""), file: String(f.file ?? "") }));
  if (extra) create["check"] = String(extra.check ?? "");
  return { create };
}

/** Exact Create ENFA body shape, shown as the template placeholder in API Settings. */
export const CREATE_BODY_SAMPLE = JSON.stringify(
  {
    create: {
      ...buildCreateApproverSlots([]),
      ...Object.fromEntries(CREATE_WIRE_KEYS.map((k) => [k, ""])),
      file: [{ file_name: "", file: "" }],
      check: "",
    },
  },
  null,
  2,
);

/**
 * Approval-flow `get_data` body. Predefined ("X") sends plant/type/function and
 * never `enfa_no`; Dynamic ("") sends only `enfa_no`, other fields blank.
 */
export function buildApprovalFlowPayload(
  template: Record<string, unknown>,
  input: { check: "X" | ""; plant: string; nfaType: string; funct: string; enfaNo?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...template };
  const dynamic = input.check === "";
  const set = (key: string, value: string) => {
    const k = Object.keys(out).find((c) => c.toLowerCase() === key) ?? key;
    out[k] = value.trim();
  };
  set("check", input.check);
  set("plant", dynamic ? "" : input.plant);
  set("nfa_type", dynamic ? "" : input.nfaType);
  set("funct", dynamic ? "" : input.funct);
  for (const k of Object.keys(out)) if (k.toLowerCase() === "enfa_no") delete out[k];
  if (dynamic) out["enfa_no"] = String(input.enfaNo ?? "").trim();
  return out;
}
