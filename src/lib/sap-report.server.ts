import { admin, callSap, getSecret, loadSystem, type SapCallResult } from "./sap-call.server";
import { wrapReportPayload } from "./sap-api-constants";

/** Resolves credentials for an endpoint row (endpoint override -> system -> legacy global). */
async function credentialsFor(ep: Record<string, any>, sys: Record<string, any> | null) {
  const username = ep.username || sys?.username || "";
  const password =
    (await getSecret(`endpoint:${ep.id}`)) ??
    (sys ? await getSecret(`system:${sys.id}`) : null) ??
    (await getSecret("sap_password")) ??
    "";
  return { username, password };
}

/**
 * Sends a new eNFA to SAP through the registered "Create ENFA" endpoint.
 * The endpoint (host, path, method, headers, query, credentials) comes entirely
 * from Admin -> SAP API Settings — nothing is hardcoded here.
 */
export async function callEnfaCreate(payload: Record<string, unknown>): Promise<SapCallResult> {
  const db = await admin();
  const { data: ep } = await db
    .from("sap_endpoint")
    .select("*")
    .or(
      [
        "name.ilike.%create enfa%",
        "name.ilike.%create e-nfa%",
        "name.ilike.%create%",
        "path_or_url.ilike.%create%",
      ].join(","),
    )
    .not("name", "ilike", "%company%")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Create ENFA endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/**
 * Fetches the Company value-help (F4) list from SAP through the registered
 * "Company F4" endpoint. Path, method, headers, query, body template and
 * credentials all come from Admin → SAP API Settings.
 */
export async function callSapCompanyF4(): Promise<SapCallResult> {
  const db = await admin();
  const { data: exactEndpoint } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Company F4")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Compatibility fallback for installations that use a longer company-specific
  // label. Never infer this endpoint from cc_code because Create ENFA also has it.
  const { data: fallbackEndpoint } = exactEndpoint
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%company%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
  const ep = exactEndpoint ?? fallbackEndpoint;

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Company F4 endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);
  const method = (ep.http_method ?? "GET").toUpperCase();
  const body = (ep.request_body ?? "").trim() || JSON.stringify({ cc_code: "" });
  try {
    JSON.parse(body);
  } catch {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The Company F4 request body in Admin → SAP API Settings is not valid JSON. Expected something like { \"cc_code\": \"\" }.",
    };
  }

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method,
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: method === "DELETE" ? undefined : body,
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

export const REPORT_KEYS = [
  "plant_from", "plant_to", "funct_from", "funct_to", "nfano_from", "nfano_to",
  "extra_from", "extra_to", "dat_from", "dat_to", "usrid_from", "usrid_to",
  "r_proc", "r_comp", "r_reje",
] as const;

/**
 * Fetches the Plant value-help (F4) list from SAP for a company code through the
 * registered "Plant F4" endpoint. Host, path, method, headers, query and
 * credentials all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callSapPlantF4(bukrs: string): Promise<SapCallResult> {
  const db = await admin();
  const { data: exactEndpoint } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Plant F4")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallbackEndpoint } = exactEndpoint
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%plant%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%report%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
  const ep = exactEndpoint ?? fallbackEndpoint;

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Plant F4 endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);
  const method = (ep.http_method ?? "GET").toUpperCase();

  // Start from the configured body template so any extra keys the customer adds
  // in API Settings are preserved, then set the selected company code.
  let payload: Record<string, unknown> = { plant: { bukrs } };
  const template = (ep.request_body ?? "").trim();
  if (template) {
    try {
      const parsed = JSON.parse(template);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const inner = (parsed as Record<string, unknown>)["plant"];
        payload = {
          ...(parsed as Record<string, unknown>),
          plant: { ...(inner && typeof inner === "object" ? inner : {}), bukrs },
        };
      }
    } catch {
      return {
        ok: false,
        status: null,
        latencyMs: 0,
        body: "",
        error:
          'The Plant F4 request body in Admin → SAP API Settings is not valid JSON. Expected something like { "plant": { "bukrs": "" } }.',
      };
    }
  }

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method,
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: method === "DELETE" ? undefined : JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

export type ReportKey = (typeof REPORT_KEYS)[number];

/**
 * Fetches the eNFA Type value-help (F4) list from SAP through the registered
 * "ENFA Type F4" endpoint. Host, path, method, headers, query, body template
 * and credentials all come from Admin → SAP API Settings.
 */
export async function callSapEnfaTypeF4(): Promise<SapCallResult> {
  const db = await admin();
  const { data: exactEndpoint } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "ENFA Type F4")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallbackEndpoint } = exactEndpoint
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%type%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%report%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
  const ep = exactEndpoint ?? fallbackEndpoint;

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP ENFA Type F4 endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);
  const method = (ep.http_method ?? "GET").toUpperCase();

  let payload: Record<string, unknown> = { type: { nfa_typ: "" } };
  const template = (ep.request_body ?? "").trim();
  if (template) {
    try {
      const parsed = JSON.parse(template);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      return {
        ok: false,
        status: null,
        latencyMs: 0,
        body: "",
        error:
          'The ENFA Type F4 request body in Admin → SAP API Settings is not valid JSON. Expected something like { "type": { "nfa_typ": "" } }.',
      };
    }
  }

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method,
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: method === "DELETE" ? undefined : JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/** Builds the exact 15-key SAP payload from arbitrary input (dynamic, no hardcoded values). */
export function buildReportPayload(input: unknown): Record<ReportKey, string> {
  let src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  // Accept both a flat object and SAP's wrapped `{ report: { ... } }` shape.
  if (src["report"] && typeof src["report"] === "object") src = src["report"] as Record<string, unknown>;
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
    body: JSON.stringify(wrapReportPayload(payload)),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/**
 * Fetches a single eNFA record's details from SAP for the given record number.
 * The endpoint is looked up dynamically — nothing about the SAP URL or payload is hardcoded.
 */
export async function callEnfaDetail(reffld: string): Promise<SapCallResult> {
  const db = await admin();
  const { data: ep } = await db
    .from("sap_endpoint")
    .select("*")
    .or("name.ilike.%detail%,name.ilike.%deatil%,name.ilike.%number%")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP eNFA record-details endpoint is not registered yet. Add it in Admin → SAP API Settings.",
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
    body: JSON.stringify({ edit: { reffld } }),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/**
 * Sends an edited eNFA record back to SAP through the registered update endpoint.
 * The endpoint is looked up dynamically — nothing about the SAP URL or payload is hardcoded.
 */
export async function callEnfaUpdate(payload: Record<string, unknown>): Promise<SapCallResult> {
  const db = await admin();
  const { data: ep } = await db
    .from("sap_endpoint")
    .select("*")
    .or(
      [
        "name.ilike.%change report%",
        "name.ilike.%enfa update%",
        "name.ilike.%update%",
        "name.ilike.%submit%",
        "name.ilike.%change%",
        "path_or_url.ilike.%enfa_update%",
        "path_or_url.ilike.%enfa_change%",
      ].join(","),
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP eNFA update endpoint is not registered yet. Add it in Admin → SAP API Settings to submit changes back to SAP.",
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
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}
