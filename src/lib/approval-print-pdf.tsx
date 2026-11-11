import { fetchSapLogoDataUrl } from "@/lib/sap-logo";
import { createRoot } from "react-dom/client";
import { EnfaDocument, type EnfaDocumentComment } from "@/components/document/EnfaDocument";
import type { ApprovalPrintDocument } from "@/lib/approval-print-document";
import { fetchResolvedSapApprovalFlow, mergeApprovalFlow } from "@/lib/sap-approval-flow";
import { pairPrintCommentsWithApprovers } from "@/lib/print-comment-history";
import { createPrintFormPdf } from "@/lib/print-form-pdf";
import { stampActingApproverDate } from "@/lib/print-comment-history";

async function loadCompanyLogo(companyCode: string, token: string): Promise<string | undefined> {
  if (!companyCode.trim() || !token) return undefined;
  const result = { dataUrl: await fetchSapLogoDataUrl(companyCode, token) };
  if (result.dataUrl.startsWith("data:image/png")) return result.dataUrl;
  const image = new Image();
  image.decoding = "async";
  image.src = result.dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The company logo cannot be prepared");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
  return canvas.toDataURL("image/png");
}

export async function createApprovalPrintFormPdf(input: {
  nfaNo: string;
  document: ApprovalPrintDocument;
  comments: EnfaDocumentComment[];
  approvalFlow: { plant: string; nfaType: string; functionName: string };
  documentStatus?: string;
  token: string;
  approvalComment: string;
  approverName: string;
  /** Acting approver's SAP User ID, resolved to the chain's approver name. */
  approverId?: string;
  /** Approval level being actioned; stamped with today's date when SAP has none yet. */
  actingLevel?: number;
}): Promise<{ base64: string; filename: string; byteLength: number }> {
  const canLoadApprovalFlow = Boolean(input.approvalFlow.plant.trim() && (input.approvalFlow.nfaType.trim() || input.nfaNo.trim()));
  const [logoSrc, flow] = await Promise.all([
    loadCompanyLogo(input.document.companyCode, input.token).catch(() => undefined),
    canLoadApprovalFlow
      ? fetchResolvedSapApprovalFlow({ ...input.approvalFlow, enfaNo: input.nfaNo }, input.token).catch(() => ({ approvers: [], functionName: "" }))
      : Promise.resolve({ approvers: [], functionName: "" }),
  ]);
  const approvers = stampActingApproverDate(
    mergeApprovalFlow(input.document.approvers, flow.approvers, false),
    input.actingLevel,
    input.approverId,
  );
  const actingId = input.approverId?.trim() ?? "";
  const actingName = actingId
    ? approvers.find((a) => a.userId?.trim().toLowerCase() === actingId.toLowerCase())?.name?.trim()
      || (typeof input.actingLevel === "number" ? approvers.find((a, i) => (a.level ?? i + 1) === input.actingLevel)?.name?.trim() : "")
      || ""
    : "";
  const comments = pairPrintCommentsWithApprovers(input.approvalComment.trim()
    ? [...input.comments, {
        name: actingName || (actingId ? "" : input.approverName.trim()),
        approverId: actingId || undefined,
        level: input.actingLevel,
        text: input.approvalComment.trim(),
      }]
    : input.comments, approvers);
  const source = document.createElement("div");
  source.className = "enfa-print-area enfa-pdf-source";
  document.body.append(source);
  const root = createRoot(source);
  try {
    root.render(
      <EnfaDocument
        companyCode={input.document.companyCode}
        companyName={input.document.companyName}
        nfaNo={input.nfaNo}
        plantLabel={input.document.plantLabel}
        date={input.document.date}
        initiator={input.document.initiator}
        nfaType={input.document.nfaType}
        functionName={input.document.functionName || flow.functionName}
        subject={input.document.subject}
        scopeImpact={input.document.scope}
        timelineDays={input.document.timeline}
        budgetImpact={input.document.budget}
        descriptionHtml={input.document.description}
        approvers={approvers}
        comments={comments}
        logoSrc={logoSrc}
      />,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const pdf = await createPrintFormPdf(source, { nfaNo: input.nfaNo, documentStatus: input.documentStatus });
    return { base64: pdf.base64, filename: pdf.filename, byteLength: pdf.bytes.length };
  } finally {
    root.unmount();
    source.remove();
  }
}