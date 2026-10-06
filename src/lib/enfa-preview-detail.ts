import { supabase } from "@/integrations/supabase/client";
import { parseApprovalPrintDetail, resolveApprovalPrintDocument } from "@/lib/approval-print-document";
import type { EnfaDocumentProps } from "@/components/document/EnfaDocument";

/** SAP alone determines DD availability; this read never loads a saved draft. */
export async function loadSapPreviewDetail(
  enfaNumber: string,
  endpoint: "report" | "select",
  row: Record<string, unknown>,
  signal: AbortSignal,
): Promise<EnfaDocumentProps | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
  if (signal.aborted) throw new DOMException("Preview closed", "AbortError");
  const response = await fetch(endpoint === "select" ? "/api/public/enfa-select" : "/api/public/enfa-detail", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ edit: { user_name: (profile?.username ?? "").toUpperCase(), reffld: enfaNumber } }),
    signal,
  });
  const text = await response.text();
  const parsed = parseApprovalPrintDetail(text);
  if (!response.ok) throw new Error(parsed.message || `SAP details failed (HTTP ${response.status})`);
  if (!parsed.detail) {
    // An explicit failure is not a record with empty DD.
    let result: { ok?: boolean } = {};
    try { result = JSON.parse(text); } catch { /* SAP plain no-data response */ }
    if (result?.ok === false) throw new Error(parsed.message || "SAP record details are temporarily unavailable");
    return null;
  }
  const { document, comments } = resolveApprovalPrintDocument({ editDetail: parsed.detail, worklistRow: row });
  // The worklist can fill header fields, but must not establish SAP DD availability.
  const description = String(parsed.detail.TEXT || parsed.detail.DETAILED_DESCRIPTION || "").trim();
  return {
    nfaNo: enfaNumber,
    companyCode: document.companyCode,
    companyName: document.companyName,
    plantLabel: document.plantLabel,
    date: document.date,
    nfaType: document.nfaType,
    functionName: document.functionName,
    subject: document.subject,
    scopeImpact: document.scope,
    budgetImpact: document.budget,
    timelineDays: document.timeline,
    descriptionHtml: description,
    approvers: document.approvers,
    comments,
  };
}