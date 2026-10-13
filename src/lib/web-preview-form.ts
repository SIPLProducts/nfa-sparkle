import type { EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { prepareWebPrintForm } from "./prepare-web-print-form";
import { readPrintFormStatus } from "./print-form-status";

/** Builds the web Print Form from current SAP data, with saved records as fallback. */
export async function loadWebPreviewForm(
  enfaNumber: string,
  screen: "approvals" | "report" | "nfa_my",
  row: Record<string, unknown>,
  signal: AbortSignal,
): Promise<EnfaDocumentProps> {
  const { document, comments } = await prepareWebPrintForm(enfaNumber, screen, row, signal);
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
