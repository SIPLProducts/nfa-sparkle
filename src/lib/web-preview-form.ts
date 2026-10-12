import type { EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { supabase } from "@/integrations/supabase/client";
import { getApprovalPrintContext } from "./print-initiator.functions";
import { parseApprovalPrintDetail, resolveApprovalPrintDocument, type PrintDataSource } from "./approval-print-document";
import { readPrintFormStatus } from "./print-form-status";

/** Reads the current SAP record (Edit / Select services) for the signed-in user; never throws. */
async function loadSapRecordDetail(enfaNumber: string, signal: AbortSignal): Promise<PrintDataSource | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return null;
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
    const body = JSON.stringify({ edit: { user_name: (profile?.username ?? "").toUpperCase(), reffld: enfaNumber } });
    const request = (endpoint: string) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body,
        signal,
      })
        .then(async (response) => (response.ok ? parseApprovalPrintDetail(await response.text()).detail : null))
        .catch(() => null);
    const [select, detail] = await Promise.all([request("/api/public/enfa-select"), request("/api/public/enfa-detail")]);
    if (!select && !detail) return null;
    return { ...(detail ?? {}), ...(select ?? {}) };
  } catch {
    return null;
  }
}

/** Builds the web Print Form from current SAP data, with saved records as fallback. */
export async function loadWebPreviewForm(
  enfaNumber: string,
  screen: "approvals" | "report" | "nfa_my",
  row: Record<string, unknown>,
  signal: AbortSignal,
): Promise<EnfaDocumentProps> {
  const [saved, sapDetail] = await Promise.all([
    getApprovalPrintContext({ data: { enfaNumber, screen } }).catch(() => null),
    loadSapRecordDetail(enfaNumber, signal),
  ]);
  if (signal.aborted) throw new DOMException("Preview closed", "AbortError");
  const hasRow = Object.values(row ?? {}).some((value) => String(value ?? "").trim());
  if (!sapDetail && !saved?.savedDetail && !hasRow) {
    throw new Error("The web Print Form details are not available for this eNFA number.");
  }
  const { document, comments } = resolveApprovalPrintDocument({
    editDetail: sapDetail,
    worklistRow: row,
    savedDetail: saved?.savedDetail ?? null,
    comments: saved?.savedComments ?? [],
    initiatorName: saved?.initiatorName ?? "",
  });
  return {
    nfaNo: enfaNumber,
    documentStatus: readPrintFormStatus(row),
    companyCode: document.companyCode,
    companyName: document.companyName,
    plantLabel: document.plantLabel,
    date: document.date,
    initiator: document.initiator,
    nfaType: document.nfaType,
    functionName: document.functionName,
    subject: document.subject,
    scopeImpact: document.scope,
    budgetImpact: document.budget,
    timelineDays: document.timeline,
    descriptionHtml: document.description,
    approvers: document.approvers,
    comments,
  };
}
