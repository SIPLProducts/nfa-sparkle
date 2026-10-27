import { supabase } from "@/integrations/supabase/client";
import { getApprovalPrintContext, getInitiatorRecordDetail, resolveApproverNames } from "@/lib/print-initiator.functions";
import { loadPrintComments } from "@/lib/print-form-data";
import { wrapReportPayload } from "@/lib/sap-api-constants";
import { parseApprovalPrintDetail, resolveApprovalPrintDocument, type PrintDataSource } from "@/lib/approval-print-document";
import { fetchResolvedSapApprovalFlow, restrictToFlow } from "@/lib/sap-approval-flow";
import { mergeCompletePrintComments } from "@/lib/print-comment-history";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";

/** Replaces blank or ID-only approver names with the portal name for that User ID. */
export function applyApproverNames(approvers: EnfaDocumentApprover[], names: Record<string, string>): EnfaDocumentApprover[] {
  return approvers.map((a) => {
    const id = a.userId?.trim() ?? "";
    const portal = names[id.toUpperCase()];
    const current = a.name?.trim() ?? "";
    return portal && (!current || current.toUpperCase() === id.toUpperCase()) ? { ...a, name: portal } : a;
  });
}

/** Fills blank, numeric or generic "Approver N" comment names from the approval grid (User ID, then level), else shows the User ID. */
export function fillCommentNamesFromChain<T extends { name: string; approverId?: string; level?: number }>(
  comments: T[],
  approvers: { userId?: string; name?: string; level?: number }[],
): T[] {
  return comments.map((c) => {
    const current = c.name?.trim() ?? "";
    if (current && !/^\d+$/.test(current) && !/^approver\s*\d+$/i.test(current)) return c;
    const id = (c.approverId?.trim() || (/^\d+$/.test(current) ? current : "")).toUpperCase();
    const byId = id ? approvers.find((a) => (a.userId ?? "").trim().toUpperCase() === id) : undefined;
    const byLevel = !byId && typeof c.level === "number" ? approvers.find((a, i) => (a.level ?? i + 1) === c.level) : undefined;
    const source = byId ?? byLevel;
    const chainName = source?.name?.trim() ?? "";
    const name = (chainName && chainName.toUpperCase() !== (source?.userId ?? "").trim().toUpperCase() ? chainName : "")
      || id || (source?.userId ?? "").trim() || current;
    return name === current ? c : { ...c, name };
  });
}

/** Replaces blank or ID-only comment names with the portal name for that User ID. */
export function applyCommentNames<T extends { name: string; approverId?: string }>(comments: T[], names: Record<string, string>): T[] {
  return comments.map((c) => {
    const id = c.approverId?.trim() ?? "";
    const current = c.name?.trim() ?? "";
    const portal = (id ? names[id.toUpperCase()] : "") || names[current.replace(/^0+/, "").toUpperCase()] || names[current.toUpperCase()] || "";
    if (!portal) return c;
    const idOnly = !current || current.toUpperCase() === id.toUpperCase() || /^\d+$/.test(current) || names[current.toUpperCase()] === portal;
    return idOnly ? { ...c, name: portal } : c;
  });
}

/** Report supplements Select without replacing populated Select fields with blanks. */
export function supplementPrintDetail(primary: PrintDataSource | null, supplemental: PrintDataSource | null): PrintDataSource {
  const merged: PrintDataSource = {};
  for (const source of [primary, supplemental]) {
    for (const [key, value] of Object.entries(source ?? {})) {
      const normalized = key.trim().toUpperCase();
      if (String(value ?? "").trim()) merged[normalized] = value;
    }
  }
  return merged;
}

function recordReportRow(value: unknown, enfaNumber: string): PrintDataSource | null {
  let current = value;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === "string") {
      try { current = JSON.parse(current); continue; } catch { return null; }
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const envelope = current as PrintDataSource;
      const key = Object.keys(envelope).find((key) => ["body", "data", "items", "result", "response"].includes(key.toLowerCase()));
      if (key) { current = envelope[key]; continue; }
    }
    break;
  }
  if (!Array.isArray(current)) return null;
  return current
    .filter((row): row is PrintDataSource => !!row && typeof row === "object" && !Array.isArray(row))
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toUpperCase(), value])))
    .find((row) => String(row.REFFLD ?? "").trim() === enfaNumber) ?? null;
}

/** Complete read-only preparation shared by Approvals Print Form and X Preview. */
export async function prepareWebPrintForm(
  enfaNumber: string,
  screen: "approvals" | "report" | "nfa_my",
  row: PrintDataSource,
  signal?: AbortSignal,
) {
  const ensureActive = () => {
    if (signal?.aborted) throw new DOMException("Print Form closed", "AbortError");
  };
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  ensureActive();
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
  const userName = (profile?.username ?? "").toUpperCase();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  const editBody = JSON.stringify({ edit: { user_name: userName, reffld: enfaNumber } });
  const requestDetail = (endpoint: string) => fetch(endpoint, { method: "POST", headers, body: editBody, signal })
    .then(async (response) => response.ok ? parseApprovalPrintDetail(await response.text()).detail : null)
    .catch(() => null);
  const reportBody = wrapReportPayload({
    plant_from: "", plant_to: "", funct_from: "", funct_to: "",
    nfano_from: enfaNumber, nfano_to: enfaNumber,
    extra_from: "", extra_to: "", dat_from: "", dat_to: "",
    usrid_from: "", usrid_to: "", r_proc: "", r_comp: "",
    r_reje: "", r_init: "", r_clar: "",
  }, userName);
  const [editDetail, ownSelectDetail, reportRow, draftResult, comments, saved] = await Promise.all([
    requestDetail("/api/public/enfa-detail"),
    requestDetail("/api/public/enfa-select"),
    fetch("/api/public/enfa-report", { method: "POST", headers, body: JSON.stringify(reportBody), signal })
      .then(async (response) => response.ok ? recordReportRow(await response.json(), enfaNumber) : null)
      .catch(() => null),
    supabase.from("sap_record_draft").select("subject, scope_impact, budget_impact, timeline_days, detailed_description")
      .eq("enfa_number", enfaNumber).maybeSingle(),
    loadPrintComments(enfaNumber).catch(() => []),
    getApprovalPrintContext({ data: { enfaNumber, screen } }).catch(() => null),
  ]);
  ensureActive();
  // SAP answers Select only for the initiator; approvers get nothing back, so the
  // server retries the read-only Select on the initiator's behalf.
  let selectDetail = ownSelectDetail;
  let initiatorName = saved?.initiatorName?.trim() ?? "";
  if ((!editDetail && !selectDetail) || !initiatorName) {
    const initiatorDetail = await getInitiatorRecordDetail({ data: { enfaNumber, screen } }).catch(() => null);
    ensureActive();
    if (initiatorDetail && !editDetail && !selectDetail) selectDetail = parseApprovalPrintDetail(JSON.stringify([initiatorDetail])).detail;
    if (!initiatorName) initiatorName = initiatorDetail?.INIT_DISPLAY_NAME?.trim() ?? "";
  }
  const hasRow = Object.values(row).some((value) => String(value ?? "").trim());
  if (!editDetail && !selectDetail && !reportRow && !saved?.savedDetail && !draftResult.data && !hasRow) {
    throw new Error("The web Print Form details are not available for this eNFA number.");
  }
  const resolved = resolveApprovalPrintDocument({
    editDetail,
    selectDetail: supplementPrintDetail(selectDetail, reportRow),
    worklistRow: row,
    savedDetail: saved?.savedDetail,
    draft: draftResult.data,
    comments,
    initiatorName,
  });
  const plant = String(row.PSPNR ?? "").trim() || resolved.document.plantLabel.split(/[–-]/)[0]?.trim() || "";
  const flow = plant && resolved.document.nfaType
    ? await fetchResolvedSapApprovalFlow({ plant, nfaType: resolved.document.nfaType, functionName: resolved.document.functionName, enfaNo: enfaNumber }, session.access_token, signal)
      .catch(() => ({ approvers: [], functionName: "" }))
    : { approvers: [], functionName: "" };
  ensureActive();
  const mergedApprovers = restrictToFlow(resolved.document.approvers, flow.approvers);
  const ids = [...mergedApprovers.map((a) => a.userId), ...comments.flatMap((c) => [c.approverId ?? "", /^\d+$/.test(c.name?.trim() ?? "") ? c.name.trim() : ""]), ...(saved?.savedComments ?? []).flatMap((c) => [/^\d+$/.test(c.name?.trim() ?? "") ? c.name.trim() : ""])].filter((id) => id?.trim());
  const names = ids.length
    ? await resolveApproverNames({ data: { userIds: ids, screen } }).catch(() => ({} as Record<string, string>))
    : {};
  ensureActive();
  const document = {
    ...resolved.document,
    initiator: resolved.document.initiator || String(reportRow?.INIT_NAME ?? reportRow?.INIT_USERID ?? "").trim(),
    functionName: resolved.document.functionName || flow.functionName,
    approvers: applyApproverNames(mergedApprovers, names),
  };
  const missingFields = resolved.missingFields.filter((field) =>
    !(field === "Function" && document.functionName) && !(field === "Approval Chain" && document.approvers.length),
  );
  return {
    document,
    comments: applyCommentNames(mergeCompletePrintComments(comments, saved?.savedComments ?? [], document.approvers), names),
    missingFields,
  };
}