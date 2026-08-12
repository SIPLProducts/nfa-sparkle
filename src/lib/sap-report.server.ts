import { admin, callSap, getSecret, loadSystem, type SapCallResult } from "./sap-call.server";

export const REPORT_KEYS = [
  "plant_from", "plant_to", "funct_from", "funct_to", "nfano_from", "nfano_to",
  "extra_from", "extra_to", "dat_from", "dat_to", "usrid_from", "usrid_to",
  "r_proc", "r_comp", "r_reje",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

/** Builds the exact 15-key SAP payload from arbitrary input (dynamic, no hardcoded values). */
export function buildReportPayload(input: unknown): Record<ReportKey, string> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const normalised: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) normalised[k.trim().toLowerCase()] = v;
  const out = {} as Record<ReportKey, string>;
  for (const k of REPORT_KEYS) out[k] = (normalised[k] ?? "").toString().trim();
  return out;
}

/** Calls the registered eNFA Report SAP endpoint and returns SAP's raw result. */
export async function callEnfaReport(payload: Record<string, string>): Promise<SapCallResult> {
  const db = await admin();
  const { data: ep } = await db
    .from("sap_endpoint")
    .select("*")
    .or("name.eq.eNFA Report,path_or_url.ilike.%enfa_report%")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error: "The eNFA Report endpoint is not registered in API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const username = ep.username || sys?.username || "";
  const password =
    (await getSecret(`endpoint:${ep.id}`)) ??
    (sys ? await getSecret(`system:${sys.id}`) : null) ??
    (await getSecret("sap_password")) ??
    "";

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}
