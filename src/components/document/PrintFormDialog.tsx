import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileDown, FileUp, Loader2, Pencil, Printer, Save } from "lucide-react";
import { EnfaDocument, type EnfaDocumentApprover, type EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateEnfaDocx } from "@/lib/enfa-docx.functions";
import {
  DOCX_MIME,
  downloadWorkingDocument,
  embedDescriptionImages,
  extractDescriptionFromDocx,
  fileToBase64,
  loadWorkingDocument,
  saveGeneratedDocx,
  type WorkingDocumentInfo,
} from "@/lib/enfa-working-document";
import { normalizeEnfaDocument } from "@/lib/enfa-document-model";
import { fetchSapApprovalFlow, mergeApprovalFlow } from "@/lib/sap-approval-flow";

export interface ApprovalFlowRequest {
  plant: string;
  nfaType: string;
  functionName: string;
}

export interface PrintFormDialogProps extends EnfaDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  onDescriptionChange?: (html: string) => void;
  onSaved?: (html: string) => void;
  approvalFlow?: ApprovalFlowRequest;
  /** Existing workflow status, used only to decide whether the exported PDF is a draft. */
  documentStatus?: string;
}

const PDF_PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 15,
  footerBaselineMm: 289,
  stageWidthPx: 760,
  frameInsetMm: 0.25,
  frameLineWidthMm: 0.35,
  draftFontSizePt: 72,
  draftCenterYmm: 157,
} as const;

function tableWithRows(source: HTMLTableElement, rows: HTMLTableRowElement[]): HTMLTableElement {
  const table = source.cloneNode(false) as HTMLTableElement;
  const body = document.createElement("tbody");
  rows.forEach((row) => body.append(row.cloneNode(true)));
  table.append(body);
  return table;
}

function contentTable(
  sourceTable: HTMLTableElement,
  sourceCell: HTMLTableCellElement,
  child?: Element,
): HTMLTableElement {
  const row = document.createElement("tr");
  const cell = sourceCell.cloneNode(false) as HTMLTableCellElement;
  const richContent = sourceCell.querySelector<HTMLElement>(".rich-content");
  if (richContent && child) {
    const richClone = richContent.cloneNode(false) as HTMLElement;
    richClone.append(child.cloneNode(true));
    cell.append(richClone);
  } else {
    Array.from(sourceCell.childNodes).forEach((node) => cell.append(node.cloneNode(true)));
  }
  row.append(cell);
  return tableWithRows(sourceTable, [row]);
}

function commentTable(
  sourceTable: HTMLTableElement,
  sourceCell: HTMLTableCellElement,
  block: Element,
): HTMLTableElement {
  const row = document.createElement("tr");
  const cell = sourceCell.cloneNode(false) as HTMLTableCellElement;
  cell.append(block.cloneNode(true));
  row.append(cell);
  return tableWithRows(sourceTable, [row]);
}

function createPdfBlocks(element: HTMLElement): HTMLElement[] {
  const documentRoot = element.querySelector<HTMLElement>(".enfa-doc");
  if (!documentRoot) return [];
  const tables = Array.from(documentRoot.querySelectorAll<HTMLTableElement>(":scope > .enfa-table"));
  const headerTable = tables[0];
  if (!headerTable) return [];

  const headerRows = Array.from(headerTable.tBodies[0]?.rows ?? []);
  const descriptionIndex = headerRows.findIndex((row) => Boolean(row.querySelector(".enfa-doc-content")));
  const blocks: HTMLElement[] = [];
  const fixedRows = descriptionIndex >= 0 ? headerRows.slice(0, descriptionIndex) : headerRows;
  if (fixedRows.length > 0) blocks.push(tableWithRows(headerTable, fixedRows));

  if (descriptionIndex >= 0) {
    const descriptionCell = headerRows[descriptionIndex]?.querySelector<HTMLTableCellElement>(".enfa-doc-content");
    if (descriptionCell) {
      const richChildren = Array.from(descriptionCell.querySelector<HTMLElement>(".rich-content")?.children ?? []);
      if (richChildren.length > 0) {
        richChildren.forEach((child) => blocks.push(contentTable(headerTable, descriptionCell, child)));
      } else {
        blocks.push(contentTable(headerTable, descriptionCell));
      }
    }
  }

  const approvalTable = tables.find((table) => Boolean(table.querySelector(".enfa-approver")));
  if (approvalTable) {
    Array.from(approvalTable.tBodies[0]?.rows ?? []).forEach((row) => {
      blocks.push(tableWithRows(approvalTable, [row]));
    });
  }

  const commentsTable = tables.find((table) => Boolean(table.querySelector(".enfa-comments")));
  const commentsCell = commentsTable?.querySelector<HTMLTableCellElement>(".enfa-comments");
  if (commentsTable && commentsCell) {
    const commentBlocks = Array.from(commentsCell.querySelectorAll<HTMLElement>(":scope > .enfa-comment-block"));
    commentBlocks.forEach((block) => blocks.push(commentTable(commentsTable, commentsCell, block)));
  }

  return blocks;
}

function createPdfPage(staging: HTMLElement): { page: HTMLElement; article: HTMLElement } {
  const page = document.createElement("section");
  page.className = "enfa-pdf-page";
  const content = document.createElement("div");
  content.className = "enfa-pdf-page-content";
  const article = document.createElement("article");
  article.className = "enfa-doc";
  content.append(article);
  page.append(content);
  staging.append(page);
  return { page, article };
}

function stagePdfPages(element: HTMLElement): { staging: HTMLElement; pages: HTMLElement[] } {
  const staging = document.createElement("div");
  staging.className = "enfa-pdf-staging enfa-pdf-export";
  document.body.append(staging);
  const blocks = createPdfBlocks(element);
  const pages: HTMLElement[] = [];
  let current = createPdfPage(staging);
  pages.push(current.page);

  for (const block of blocks) {
    current.article.append(block);
    const content = current.page.querySelector<HTMLElement>(".enfa-pdf-page-content");
    if (!content) continue;
    if (current.article.scrollHeight > content.clientHeight && current.article.children.length > 1) {
      block.remove();
      current = createPdfPage(staging);
      pages.push(current.page);
      current.article.append(block);
    }
  }

  return { staging, pages };
}

function isFinalDocumentStatus(status: string | undefined): boolean {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return normalized === "completed"
    || normalized === "closed"
    || normalized === "final"
    || normalized === "approved"
    || normalized === "finally_approved"
    || normalized === "final_approved";
}

/**
 * Read-only "Note for Approval" print form. Every value is supplied by the
 * caller from the form / record — nothing is hardcoded here.
 */
export function PrintFormDialog({
  open,
  onOpenChange,
  canEdit = false,
  onDescriptionChange,
  onSaved,
  approvalFlow,
  documentStatus,
  ...doc
}: PrintFormDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const generateDocx = useServerFn(generateEnfaDocx);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(doc.descriptionHtml ?? "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [workingDocument, setWorkingDocument] = useState<WorkingDocumentInfo | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | undefined>();
  const [logoLoading, setLogoLoading] = useState(false);
  const [flowApprovers, setFlowApprovers] = useState<EnfaDocumentApprover[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const effectiveApprovers = mergeApprovalFlow(doc.approvers, flowApprovers, false);

  useEffect(() => {
    if (!open) setEditing(false);
    setDescription(doc.descriptionHtml ?? "");
  }, [doc.descriptionHtml, open]);

  useEffect(() => {
    if (!open || !canEdit || !doc.nfaNo) return;
    let cancelled = false;
    setWorkingDocument(null);
    void loadWorkingDocument(doc.nfaNo).then((value) => { if (!cancelled) setWorkingDocument(value); });
    return () => { cancelled = true; };
  }, [canEdit, doc.nfaNo, open]);

  useEffect(() => {
    if (!open || !doc.companyCode?.trim()) {
      setLogoSrc(undefined);
      setLogoLoading(false);
      return;
    }
    const controller = new AbortController();
    setLogoSrc(undefined);
    setLogoLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const response = await fetch("/api/public/sap-logo", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ companyCode: doc.companyCode }),
          signal: controller.signal,
        });
        const result = (await response.json()) as { ok?: boolean; dataUrl?: string; message?: string; error?: string };
        if (!response.ok || !result.ok || !result.dataUrl) throw new Error(result.message || result.error || "Company logo is unavailable");
        const image = new Image();
        image.decoding = "async";
        image.src = result.dataUrl;
        await image.decode();

        // Normalise SAP's bitmap response once at its native resolution. This
        // preserves every source pixel and gives browser, PDF and Word exports
        // the same lossless image without stretching its aspect ratio.
        if (result.dataUrl.startsWith("data:image/png")) {
          setLogoSrc(result.dataUrl);
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("The company logo cannot be prepared");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
          setLogoSrc(canvas.toDataURL("image/png"));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.warning(error instanceof Error ? error.message : "Company logo is unavailable");
      } finally {
        if (!controller.signal.aborted) setLogoLoading(false);
      }
    })();
    return () => controller.abort();
  }, [doc.companyCode, open]);

  useEffect(() => {
    const plant = approvalFlow?.plant.trim() ?? "";
    const nfaType = approvalFlow?.nfaType.trim() ?? "";
    const functionName = approvalFlow?.functionName.trim() ?? "";
    if (!open || !plant || !nfaType || !functionName) {
      setFlowApprovers([]);
      setApprovalLoading(false);
      return;
    }
    const controller = new AbortController();
    setFlowApprovers([]);
    setApprovalLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        setFlowApprovers(await fetchSapApprovalFlow({ plant, nfaType, functionName }, token, controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.warning(error instanceof Error ? `${error.message}. Showing saved approval details.` : "Showing saved approval details.");
      } finally {
        if (!controller.signal.aborted) setApprovalLoading(false);
      }
    })();
    return () => controller.abort();
  }, [approvalFlow?.functionName, approvalFlow?.nfaType, approvalFlow?.plant, open]);

  async function preparedLogo(): Promise<{ dataUrl: string; width: number; height: number } | undefined> {
    if (!logoSrc) return undefined;
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 120 / image.naturalWidth, 58 / image.naturalHeight);
        resolve({
          dataUrl: logoSrc,
          width: Math.max(1, Math.round(image.naturalWidth * scale)),
          height: Math.max(1, Math.round(image.naturalHeight * scale)),
        });
      };
      image.onerror = () => reject(new Error("The company logo format cannot be opened"));
      image.src = logoSrc;
    });
  }

  async function waitForPrintImages(element: HTMLElement): Promise<void> {
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      try {
        await image.decode();
      } catch {
        // A failed optional image must not prevent the rest of the form export.
      }
    }));
  }

  async function createOrDownloadDocx() {
    if (!doc.nfaNo) {
      toast.info("Submit the NFA first to receive an eNFA number");
      return;
    }
    setDocxBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Your session has expired. Please sign in again.");
      const embeddedDescription = await embedDescriptionImages(description);
      const logo = await preparedLogo();
      const generated = await generateDocx({
        data: {
          companyName: doc.companyName,
          nfaNo: doc.nfaNo,
          plantLabel: doc.plantLabel,
          date: doc.date,
          initiator: doc.initiator,
          nfaType: doc.nfaType,
          functionName: doc.functionName,
          subject: doc.subject,
          scopeImpact: doc.scopeImpact,
          timelineDays: doc.timelineDays,
          budgetImpact: doc.budgetImpact,
          descriptionHtml: embeddedDescription.html,
          descriptionImages: embeddedDescription.images,
          approvers: effectiveApprovers,
          comments: doc.comments,
          logoBase64: logo?.dataUrl,
          logoWidth: logo?.width,
          logoHeight: logo?.height,
        },
      });
      const saved = await saveGeneratedDocx({ enfaNumber: doc.nfaNo, userId, ...generated });
      setWorkingDocument(saved);
      await downloadWorkingDocument(saved);
      toast.success(`Editable DOCX version ${saved.version} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the DOCX");
    } finally {
      setDocxBusy(false);
    }
  }

  async function uploadRevisedDocx(file: File) {
    if (!doc.nfaNo) return;
    setDocxBusy(true);
    try {
      const html = await extractDescriptionFromDocx(file, doc.nfaNo);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Your session has expired. Please sign in again.");
      const { error } = await supabase.from("sap_record_draft").upsert({
        enfa_number: doc.nfaNo,
        detailed_description: html,
        updated_by: userId,
      });
      if (error) throw error;
      const saved = await saveGeneratedDocx({
        enfaNumber: doc.nfaNo,
        userId,
        base64: await fileToBase64(file),
        filename: file.name,
      });
      setDescription(html);
      setWorkingDocument(saved);
      onDescriptionChange?.(html);
      onSaved?.(html);
      toast.success(`Revised DOCX saved as version ${saved.version}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the revised DOCX");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
      setDocxBusy(false);
    }
  }

  async function saveDescription() {
    setSaving(true);
    try {
      if (doc.nfaNo) {
        const { data: sessionData } = await supabase.auth.getSession();
        const { error } = await supabase.from("sap_record_draft").upsert({
          enfa_number: doc.nfaNo,
          detailed_description: description || null,
          updated_by: sessionData.session?.user.id ?? null,
        });
        if (error) throw error;
      }
      onDescriptionChange?.(description);
      onSaved?.(description);
      setEditing(false);
      toast.success("Detailed Description saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the description");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    const element = printRef.current;
    if (!element || editing) return;
    setDownloading(true);
    let staging: HTMLElement | undefined;
    try {
      await document.fonts?.ready;
      await waitForPrintImages(element);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const staged = stagePdfPages(element);
      staging = staged.staging;
      await waitForPrintImages(staging);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = PDF_PAGE.widthMm - PDF_PAGE.marginMm * 2;
      const pageHeight = PDF_PAGE.heightMm - PDF_PAGE.marginMm * 2 - 9;
      const draft = !isFinalDocumentStatus(documentStatus);
      for (let pageIndex = 0; pageIndex < staged.pages.length; pageIndex += 1) {
        const page = staged.pages[pageIndex];
        if (!page) continue;
        const pageCanvas = await html2canvas(page, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          width: PDF_PAGE.stageWidthPx,
          height: page.offsetHeight,
          windowWidth: PDF_PAGE.stageWidthPx,
          scrollX: 0,
          scrollY: 0,
        });
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          PDF_PAGE.marginMm,
          PDF_PAGE.marginMm,
          pageWidth,
          pageHeight,
          undefined,
          "MEDIUM",
        );

        // Draw the page frame as a PDF vector so JPEG scaling cannot clip or
        // soften the right and bottom edges of the captured document.
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(PDF_PAGE.frameLineWidthMm);
        pdf.rect(
          PDF_PAGE.marginMm + PDF_PAGE.frameInsetMm,
          PDF_PAGE.marginMm + PDF_PAGE.frameInsetMm,
          pageWidth - PDF_PAGE.frameInsetMm * 2,
          pageHeight - PDF_PAGE.frameInsetMm * 2,
          "S",
        );

        if (draft) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(PDF_PAGE.draftFontSizePt);
          pdf.setTextColor(175, 175, 175);
          pdf.text("DRAFT", PDF_PAGE.widthMm / 2, PDF_PAGE.draftCenterYmm, { align: "center", angle: 45 });
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text(
          `ENFA No. ${doc.nfaNo || "Draft"} – ${pageIndex + 1} of ${staged.pages.length}`,
          PDF_PAGE.widthMm - PDF_PAGE.marginMm,
          PDF_PAGE.footerBaselineMm,
          { align: "right" },
        );
      }
      pdf.save(`ENFA-${doc.nfaNo || "draft"}.pdf`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      toast.error(detail ? `Could not generate the Print Form PDF: ${detail}` : "Could not generate the Print Form PDF");
    } finally {
      staging?.remove();
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Print Form · {doc.nfaNo || "—"}</DialogTitle>
          <DialogDescription className="sr-only">Review and export the complete Note for Approval document.</DialogDescription>
        </DialogHeader>

        <div ref={printRef} data-enfa-print-area className="enfa-print-area max-h-[70vh] overflow-y-auto bg-white p-2">
           <EnfaDocument
             {...normalizeEnfaDocument({ ...doc, descriptionHtml: description, approvers: effectiveApprovers })}
              logoSrc={logoSrc}
            editableDescription={editing ? description : undefined}
            onDescriptionChange={editing ? setDescription : undefined}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {canEdit && doc.nfaNo ? (
            <div className="mr-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {workingDocument ? <span>DOCX v{workingDocument.version}</span> : <span>No DOCX saved</span>}
              <input
                ref={uploadRef}
                type="file"
                accept={`.docx,${DOCX_MIME}`}
                className="hidden"
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadRevisedDocx(file); }}
              />
            </div>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {canEdit && !editing ? (
            <Button variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Description
            </Button>
          ) : null}
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setDescription(doc.descriptionHtml ?? ""); setEditing(false); }}>Cancel</Button>
              <Button className="gap-1.5" onClick={() => void saveDescription()} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
            </>
          ) : (
            <>
              {canEdit && doc.nfaNo ? (
                <>
                   <Button variant="outline" className="gap-1.5" onClick={() => void createOrDownloadDocx()} disabled={docxBusy || logoLoading || approvalLoading}>
                    {docxBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Download DOCX
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => uploadRef.current?.click()} disabled={docxBusy}>
                    <FileUp className="h-3.5 w-3.5" /> Upload Revised DOCX
                  </Button>
                </>
              ) : (
                 <Button variant="outline" className="gap-1.5" onClick={() => void downloadPdf()} disabled={downloading || logoLoading || approvalLoading}>
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PDF
                </Button>
              )}
            </>
          )}
          <Button className="gap-1.5" onClick={() => window.print()} disabled={logoLoading || approvalLoading}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
