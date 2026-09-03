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
  // Every registered endpoint shares the same path, so the endpoint must be
  // resolved by name only — never by path_or_url.
  const { data: exactEndpoint } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Create ENFA")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallbackEndpoint } = exactEndpoint
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .or(["name.ilike.%create enfa%", "name.ilike.%create e-nfa%"].join(","))
        .not("name", "ilike", "%report%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%type%")
        .not("name", "ilike", "%function%")
        .not("name", "ilike", "%change%")
        .not("name", "ilike", "%edit%")
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

  const body = JSON.stringify(payload);
  // SAP's create service (especially with base64 attachments) regularly needs
  // far more than the 20s default; give it the full middleware/nginx budget.
  const timeoutMs = body.length > 1_000_000 ? 180_000 : 120_000;

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body,
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
    timeoutMs,
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
  "r_proc", "r_comp", "r_reje", "r_init", "r_clar",
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

/** Builds the exact SAP payload from arbitrary input (dynamic, no hardcoded values). */
export function buildReportPayload(input: unknown): Record<string, string> {
  let src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  // Accept both a flat object and SAP's wrapped `{ report: { ... } }` shape.
  if (src["report"] && typeof src["report"] === "object") src = src["report"] as Record<string, unknown>;
  const normalised: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) normalised[k.trim().toLowerCase()] = v;
  const out = {} as Record<string, string>;
  for (const k of REPORT_KEYS) out[k] = (normalised[k] ?? "").toString().trim();
  // Preserve a caller-supplied user_name; the SAP call falls back to the
  // endpoint credential when it is absent.
  const caller = (normalised["user_name"] ?? "").toString().trim();
  if (caller) out["user_name"] = caller;
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
    body: JSON.stringify(
      wrapReportPayload(payload, (payload["user_name"] || username || "").toUpperCase()),
    ),
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/**
 * Fetches a single eNFA record's details from SAP for the given record number.
 * The endpoint is looked up dynamically — nothing about the SAP URL or payload is hardcoded.
 */
export async function callEnfaDetail(
  reffld: string,
  overrides?: Record<string, unknown>,
): Promise<SapCallResult> {
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

  // Build the body from the registered template so the payload stays settings-driven.
  let template: Record<string, unknown> = {};
  try {
    const raw = ep.request_body;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      template = parsed as Record<string, unknown>;
    }
  } catch {
    template = {};
  }
  const editTemplate =
    template["edit"] && typeof template["edit"] === "object" && !Array.isArray(template["edit"])
      ? (template["edit"] as Record<string, unknown>)
      : {};
  const callerEdit = overrides && typeof overrides === "object" ? overrides : {};
  const body = {
    ...template,
    edit: {
      ...editTemplate,
      ...callerEdit,
      user_name: String(
        (callerEdit["user_name"] as string | undefined) || username || "",
      ).toUpperCase(),
      reffld,
    },
  };

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(body),
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
  return callEnfaUpdateInner(payload);
}

/**
 * Sends an edited My NFA record back to SAP through the registered "Edit IN My NFA"
 * endpoint (the approval API). Host, path, method, headers, query and credentials
 * all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaMyNfaUpdate(payload: Record<string, unknown>): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Edit IN My NFA")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .or(["name.ilike.%edit%my nfa%", "name.ilike.%my nfa%edit%", "name.ilike.%my nfa%update%"].join(","))
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP \"Edit IN My NFA\" endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
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

/**
 * Fetches a single eNFA record for editing through the registered "MY NFA Select"
 * endpoint (the approval API). Host, path, method, headers, query, body template and
 * credentials all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaSelect(
  reffld: string,
  overrides?: Record<string, unknown>,
): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "MY NFA Select")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%nfa select%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP \"MY NFA Select\" endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Use the endpoint's saved body template, substituting the live values.
  const callerEdit = overrides && typeof overrides === "object" ? overrides : {};
  let template: Record<string, unknown> = {};
  const tpl = (ep.request_body ?? "").trim();
  if (tpl) {
    try {
      const parsed = JSON.parse(tpl) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) template = parsed;
    } catch {
      /* fall back to the default shape */
    }
  }
  const editTemplate =
    template["edit"] && typeof template["edit"] === "object" && !Array.isArray(template["edit"])
      ? (template["edit"] as Record<string, unknown>)
      : {};
  const body = JSON.stringify({
    ...template,
    edit: {
      ...editTemplate,
      ...callerEdit,
      user_name: String(
        (callerEdit["user_name"] as string | undefined) || username || "",
      ).toUpperCase(),
      reffld,
    },
  });

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body,
    username: username || undefined,
    password,
    maxBytes: 2_000_000,
  });
}

/**
 * Fetches the printable eNFA document (base64) from SAP through the registered
 * "Preview Button" endpoint. Host, path, method, headers, query and credentials
 * all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaPrint(
  enfaNo: string,
  variant?: "edit" | "report",
): Promise<SapCallResult> {
  const db = await admin();

  // The My NFAs screen uses its own registered row ("Preview In Edit"); the
  // Reports screen keeps using "Preview Button".
  const { data: variantRow } =
    variant === "edit"
      ? await db
          .from("sap_endpoint")
          .select("*")
          .ilike("name", "Preview In Edit")
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const { data: exact } = variantRow
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "Preview Button")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const { data: fallback } = variantRow || exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .or(["name.ilike.%preview%", "name.ilike.%print%"].join(","))
        .not("name", "ilike", "%report%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%type%")
        .not("name", "ilike", "%function%")
        .not("name", "ilike", "%update%")
        .not("name", "ilike", "%change%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = variantRow ?? exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP eNFA Preview endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Use the endpoint's saved body template, substituting the requested number.
  let body = JSON.stringify({ PRINT: { EFNA_NO: enfaNo } });
  const tpl = (ep.request_body ?? "").trim();
  if (tpl) {
    try {
      const parsed = JSON.parse(tpl) as Record<string, unknown>;
      const print = parsed?.["PRINT"] ?? parsed?.["print"];
      if (print && typeof print === "object") {
        const p = print as Record<string, unknown>;
        if ("EFNA_NO" in p) p["EFNA_NO"] = enfaNo;
        else if ("efna_no" in p) p["efna_no"] = enfaNo;
        else p["EFNA_NO"] = enfaNo;
        body = JSON.stringify(parsed);
      }
    } catch {
      /* fall back to the default shape */
    }
  }

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body,
    username: username || undefined,
    password,
    maxBytes: 8_000_000,
    timeoutMs: 180_000,
  });
}

async function callEnfaUpdateInner(payload: Record<string, unknown>): Promise<SapCallResult> {
  const db = await admin();
  return callEnfaUpdateInnerImpl(db, payload);
}

/**
 * Fetches the documents attached to an eNFA in SAP through the registered
 * "Attachments IN Reports" endpoint. Host, path, method, headers, query and
 * credentials all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaAttachments(
  reffld: string,
  endpoint: "report" | "my" = "report",
): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", endpoint === "my" ? "Attachments In My NFA" : "Attachments IN Reports")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .or(["name.ilike.%attach%", "name.ilike.%document%"].join(","))
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%type%")
        .not("name", "ilike", "%function%")
        .not("name", "ilike", "%update%")
        .not("name", "ilike", "%change%")
        .not("name", "ilike", "%preview%")
        .not("name", "ilike", "%print%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP eNFA Attachments endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  const result = await callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify({ attachment: { reffld } }),
    username: username || undefined,
    password,
    maxBytes: 20_000_000,
    // Answered inside the browser request: stay just under the ~100 s edge window so we
    // can return a readable message instead of being cut off.
    timeoutMs: 85_000,



  });

  if (!result.ok && (result.status === null || result.status >= 500)) {
    return {
      ...result,
      error:
        result.error && result.status === null
          ? result.error
          : "SAP took too long to return the documents for this eNFA. Please try again in a moment.",
    };
  }
  return result;
}


async function callEnfaUpdateInnerImpl(db: any, payload: Record<string, unknown>): Promise<SapCallResult> {
  return callEnfaUpdateInnerImplOriginal(db, payload);
}

/**
 * Uploads documents to an eNFA in SAP through the registered "Upload Document"
 * endpoint. Host, path, method, headers, query and credentials all come from
 * Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaUpload(
  reffld: string,
  files: { file_name: string; file: string }[],
  sapUsername: string,
  endpoint: "report" | "my" = "report",
): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", endpoint === "my" ? "Attached Docs In MY NFA" : "Upload Document")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%upload%")
        .not("name", "ilike", "%report%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%type%")
        .not("name", "ilike", "%function%")
        .not("name", "ilike", "%update%")
        .not("name", "ilike", "%change%")
        .not("name", "ilike", "%preview%")
        .not("name", "ilike", "%print%")
        .not("name", "ilike", "%attach%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP eNFA Upload endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Build the body from the registered template so the payload stays
  // settings-driven; then fill in the live values (user_name, reffld, file).
  let template: Record<string, unknown> = {};
  try {
    const raw = ep.request_body;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      template = parsed as Record<string, unknown>;
    }
  } catch {
    template = {};
  }
  const uploadTemplate =
    template["upload"] && typeof template["upload"] === "object" && !Array.isArray(template["upload"])
      ? (template["upload"] as Record<string, unknown>)
      : {};
  const body = {
    ...template,
    upload: {
      ...uploadTemplate,
      user_name: sapUsername.trim().toUpperCase(),
      reffld,
      file: files,
    },
  };

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "POST").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(body),
    username: username || undefined,
    password,
    maxBytes: 20_000_000,
    timeoutMs: 180_000,
  });
}

async function callEnfaUpdateInnerImplOriginal(db: any, payload: Record<string, unknown>): Promise<SapCallResult> {
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

/**
 * Fetches the Function value-help (F4) list from SAP through the registered
 * "Function F4" endpoint. Host, path, method, headers, query, body template and
 * credentials all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callSapFunctionF4(nfaType: string): Promise<SapCallResult> {
  const db = await admin();
  const { data: exactEndpoint } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Function F4")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallbackEndpoint } = exactEndpoint
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%function%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%company%")
        .not("name", "ilike", "%plant%")
        .not("name", "ilike", "%type%")
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
        "The SAP Function F4 endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
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

  // Start from the configured body template so extra keys added in API Settings
  // are preserved, then set the selected eNFA type.
  let payload: Record<string, unknown> = { FUNC: { nfa_typ1: nfaType } };
  const template = (ep.request_body ?? "").trim();
  if (template) {
    try {
      const parsed = JSON.parse(template);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const key = Object.keys(obj).find((k) => k.trim().toLowerCase() === "func") ?? "FUNC";
        const inner = obj[key];
        payload = {
          ...obj,
          [key]: { ...(inner && typeof inner === "object" ? inner : {}), nfa_typ1: nfaType },
        };
      }
    } catch {
      return {
        ok: false,
        status: null,
        latencyMs: 0,
        body: "",
        error:
          'The Function F4 request body in Admin → SAP API Settings is not valid JSON. Expected something like { "FUNC": { "nfa_typ1": "" } }.',
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

/**
 * Fetches the eNFA approval worklist from SAP through the registered
 * "Approval Get Data" endpoint. Host, path, method, headers, query and
 * credentials all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaApproval(
  overrides?: { user_name?: string },
): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Approval Get Data")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%approval%")
        .not("name", "ilike", "%create%")
        .not("name", "ilike", "%preview%")
        .not("name", "ilike", "%print%")
        .not("name", "ilike", "%attach%")
        .not("name", "ilike", "%upload%")
        .not("name", "ilike", "%edit%")
        .not("name", "ilike", "%detail%")
        .not("name", "ilike", "%deatil%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Approval Get Data endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Build SAP's `{ "get_data": { "user_name": "..." } }` payload. A
  // caller-supplied user_name (the logged-in user's User ID) is sent
  // unchanged; otherwise the endpoint/system credential is used. The saved
  // body template's wrapper key and any extra keys are respected.
  const callerUser = (overrides?.user_name ?? "").trim();
  const effectiveUser = (callerUser || username || "").toUpperCase();

  let template: Record<string, unknown> = {};
  const raw = (ep.request_body ?? "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        template = parsed as Record<string, unknown>;
      }
    } catch {
      template = {};
    }
  }
  const wrapKey = Object.keys(template).find((k) => k.toLowerCase() === "get_data") ?? "get_data";
  const inner = template[wrapKey];
  const getData: Record<string, string> = { user_name: effectiveUser };
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
      if (k.toLowerCase() === "user_name") continue;
      getData[k] = v == null ? "" : String(v);
    }
  }
  const body = JSON.stringify({ [wrapKey]: getData });

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body,
    username: username || undefined,
    password,
    maxBytes: 4_000_000,
    timeoutMs: 180_000,
  });
}

/**
 * Sends an approval-workflow action (approve / reject / back to initiator) to
 * SAP through the matching registered endpoint. Host, path, method, headers,
 * query, credentials and the body template all come from Admin → SAP API Settings.
 */
export async function callEnfaApprovalAction(opts: {
  action: "approve" | "reject" | "back_to_initiator" | "clarification";
  reffld: string;
  comment: string;
  user_name?: string;
}): Promise<SapCallResult> {
  const config = {
    approve: { exactName: "Approved Button", pattern: "%approve%", wrapper: "approve" },
    reject: { exactName: "Reject Button", pattern: "%reject%", wrapper: "reject" },
    back_to_initiator: { exactName: "Back To Intiator", pattern: "%tiator%", wrapper: "initiator" },
    clarification: { exactName: "Clarification Button", pattern: "%clarif%", wrapper: "clarification" },
  }[opts.action];


  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", config.exactName)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", config.pattern)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error: `The SAP ${config.exactName} endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.`,
    };
  }


  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Start from the endpoint's saved body template when it parses, so admins
  // can change the wrapper/keys in API Settings without a code change.
  const defaultWrapper = opts.action === "back_to_initiator" ? "INITIATOR" : config.wrapper;
  let payload: Record<string, any> = { [defaultWrapper]: { REFFLD: "", Comment: "" } };
  const tpl = (ep.request_body ?? "").trim();
  if (tpl) {
    try {
      const parsed = JSON.parse(tpl);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
    } catch {
      /* keep the default shape */
    }
  }

  const wrapperKey =
    Object.keys(payload).find((k) => k.toLowerCase() === config.wrapper) ?? defaultWrapper;

  const inner =
    payload[wrapperKey] && typeof payload[wrapperKey] === "object" && !Array.isArray(payload[wrapperKey])
      ? { ...(payload[wrapperKey] as Record<string, any>) }
      : {};

  const refKey = Object.keys(inner).find((k) => k.toLowerCase() === "reffld") ?? "REFFLD";
  const cmtKey = Object.keys(inner).find((k) => k.toLowerCase() === "comment") ?? "Comment";
  inner[refKey] = opts.reffld;
  inner[cmtKey] = opts.comment ?? "";

  // Inject the logged-in user's User ID as `user_name`, emitted as the first
  // key of the wrapper's inner object so SAP receives
  // { "reject": { "user_name": "...", "REFFLD": "...", "Comment": "..." } }.
  const callerUser = (opts.user_name ?? "").trim();
  if (callerUser) {
    const usrKey = Object.keys(inner).find((k) => k.toLowerCase() === "user_name") ?? "user_name";
    const reordered: Record<string, any> = { [usrKey]: callerUser };
    for (const [k, v] of Object.entries(inner)) {
      if (k.toLowerCase() !== "user_name") reordered[k] = v;
    }
    payload[wrapperKey] = reordered;
  } else {
    payload[wrapperKey] = inner;
  }

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body: JSON.stringify(payload),
    username: username || undefined,
    password,
    maxBytes: 200_000,
    timeoutMs: 120_000,
  });
}

/**
 * Fetches the My NFAs list from SAP through the registered "Display Edit Data"
 * endpoint. Host, path, method, headers, query, body template and credentials
 * all come from Admin → SAP API Settings — nothing is hardcoded.
 */
export async function callEnfaDisplayEditData(
  overrides?: { user_name?: string },
): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Display Edit Data")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%display%edit%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Display Edit Data endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
    };
  }

  const sys = await loadSystem(ep.system_id ?? null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((ep.request_headers ?? {}) as Record<string, string>),
  };
  const { username, password } = await credentialsFor(ep, sys);

  // Build SAP's `{ "report": { "user_name": "..." } }` payload. A caller-supplied
  // user_name (the logged-in user's User ID) is sent unchanged; otherwise the
  // endpoint/system credential is used. The saved body template's wrapper key
  // and any extra keys are respected — nothing hardcoded.
  const callerUser = (overrides?.user_name ?? "").trim();
  const effectiveUser = (callerUser || username || "").toUpperCase();

  let template: Record<string, unknown> = {};
  const raw = (ep.request_body ?? "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        template = parsed as Record<string, unknown>;
      }
    } catch {
      template = {};
    }
  }
  const wrapKey = Object.keys(template).find((k) => k.toLowerCase() === "report") ?? "report";
  const inner = template[wrapKey];
  const report: Record<string, string> = { user_name: effectiveUser };
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
      if (k.toLowerCase() === "user_name") continue;
      report[k] = v == null ? "" : String(v);
    }
  }
  const body = JSON.stringify({ [wrapKey]: report });

  return callSap({
    system: sys,
    path: ep.path_or_url ?? "",
    method: (ep.http_method ?? "PUT").toUpperCase(),
    headers,
    query: (ep.request_query ?? {}) as Record<string, string>,
    body,
    username: username || undefined,
    password,
    maxBytes: 4_000_000,
    timeoutMs: 180_000,
  });
}

/**
 * Resolves the SAP user that a given eNFA endpoint authenticates with, so the
 * browser can send exactly the same `user_name` SAP receives. Never returns secrets.
 */
export async function resolveSapUserForEndpoint(kind: "detail" | "select"): Promise<string> {
  const db = await admin();
  const query =
    kind === "select"
      ? db.from("sap_endpoint").select("*").ilike("name", "%nfa select%")
      : db
          .from("sap_endpoint")
          .select("*")
          .or("name.ilike.%detail%,name.ilike.%deatil%,name.ilike.%number%");
  const { data: ep } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!ep) return "";
  const sys = await loadSystem(ep.system_id ?? null);
  return String(ep.username || sys?.username || "").toUpperCase();
}

/**
 * Fetches the approval chain master data from SAP through the registered
 * "Approval Chain" endpoint. Host, path, method, headers, query, body
 * template and credentials all come from Admin → SAP API Settings.
 */
export async function callApprovalChain(approver?: string): Promise<SapCallResult> {
  const db = await admin();
  const { data: exact } = await db
    .from("sap_endpoint")
    .select("*")
    .ilike("name", "Approval Chain")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: fallback } = exact
    ? { data: null }
    : await db
        .from("sap_endpoint")
        .select("*")
        .ilike("name", "%chain%")
        .not("name", "ilike", "%get data%")
        .not("name", "ilike", "%button%")
        .not("name", "ilike", "%tiator%")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const ep = exact ?? fallback;
  if (!ep) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      body: "",
      error:
        "The SAP Approval Chain endpoint is not registered or is inactive. Add or activate it in Admin → SAP API Settings.",
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

  let payload: Record<string, unknown> = { approver: "" };
  const tpl = (ep.request_body ?? "").trim();
  if (tpl) {
    try {
      const parsed = JSON.parse(tpl);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      /* keep the default shape */
    }
  }
  const approverKey = Object.keys(payload).find((k) => k.toLowerCase() === "approver") ?? "approver";
  payload[approverKey] = (approver ?? "").trim();

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
    timeoutMs: 120_000,
  });
}
