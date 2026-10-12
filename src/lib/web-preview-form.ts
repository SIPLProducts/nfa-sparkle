import type { EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { getApprovalPrintContext } from "./print-initiator.functions";
import { loadPrintDescription } from "./print-form-data";
import { resolveApprovalPrintDocument } from "./approval-print-document";

/** Uses saved Print Form data without making another SAP Preview request. */
export async function loadWebPreviewForm(
  enfaNumber: string,
  screen: "approvals" | "report" | "nfa_my",
  row: Record<string, unknown>,
  signal: AbortSignal,
): Promise<EnfaDocumentProps> {
  const [saved, description] = await Promise.all([
    getApprovalPrintContext({ data: { enfaNumber, screen } }),
    loadPrintDescription(enfaNumber),
  ]);
  if (signal.aborted) throw new DOMException("Preview closed", "AbortError");
  if (!saved.savedDetail) throw new Error("The saved web Print Form is not available for this eNFA number.");
  const { document, comments } = resolveApprovalPrintDocument({
    editDetail: saved.savedDetail,
    worklistRow: row,
    draft: { detailed_description: description },
    comments: saved.savedComments,
    initiatorName: saved.initiatorName,
  });
  return {
    nfaNo: enfaNumber,
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