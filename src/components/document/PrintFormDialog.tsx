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
} as const;

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
        setLogoSrc(result.dataUrl);
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

  async function pngLogoDataUrl(): Promise<string | undefined> {
    if (!logoSrc) return undefined;
    if (logoSrc.startsWith("data:image/png")) return logoSrc;
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("The company logo cannot be converted for Word"));
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("The company logo format cannot be opened"));
      image.src = logoSrc;
    });
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
          logoBase64: await pngLogoDataUrl(),
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
    element.classList.add("enfa-pdf-export");
    try {
      // Let the PDF-only width/containment rules settle before measuring. Rich
      // content can carry large inline dimensions from Word or screenshots.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const exportWidth = element.offsetWidth;
      const exportHeight = element.scrollHeight;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          const printable = clonedDocument.querySelector<HTMLElement>("[data-enfa-print-area]");
          if (printable) {
            printable.classList.add("enfa-pdf-export");
            printable.style.width = `${exportWidth}px`;
            printable.style.minWidth = `${exportWidth}px`;
            printable.style.maxWidth = `${exportWidth}px`;
             printable.style.maxHeight = "none";
             printable.style.height = "auto";
            printable.style.overflow = "hidden";
            printable.style.padding = "0";
          }

          clonedDocument.querySelectorAll<HTMLImageElement>(".enfa-pdf-export .rich-content img").forEach((image) => {
            image.removeAttribute("width");
            image.removeAttribute("height");
            image.style.width = "auto";
            image.style.height = "auto";
            image.style.maxWidth = "100%";
            image.style.maxHeight = "160px";
            image.style.objectFit = "contain";
          });
         },
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = PDF_PAGE.widthMm - PDF_PAGE.marginMm * 2;
      const pageHeight = PDF_PAGE.heightMm - PDF_PAGE.marginMm * 2 - 9;
       const pixelsPerPage = Math.floor((pageHeight / pageWidth) * canvas.width);
       const elementRect = element.getBoundingClientRect();
       const safeBoundaries = Array.from(
          element.querySelectorAll(
            ".enfa-table > tbody > tr, .enfa-comments, .enfa-comment-block, .rich-content > *, .rich-content img",
          ),
       )
         .flatMap((node) => {
           const rect = node.getBoundingClientRect();
           return [rect.top - elementRect.top, rect.bottom - elementRect.top];
         })
         .map((position) => Math.round(position * (canvas.height / elementRect.height)))
         .filter((position) => position > 0 && position < canvas.height)
         .sort((a, b) => a - b);

        const slices: Array<{ start: number; end: number }> = [];
        let sourceY = 0;
       while (sourceY < canvas.height) {
         const desiredEnd = Math.min(canvas.height, sourceY + pixelsPerPage);
          const earlierBoundary = safeBoundaries
            .filter((value) => value > sourceY + pixelsPerPage * 0.4 && value <= desiredEnd)
            .at(-1);
          const sourceEnd = desiredEnd < canvas.height && earlierBoundary
           ? earlierBoundary
           : desiredEnd;
          slices.push({ start: sourceY, end: sourceEnd });
          sourceY = sourceEnd;
        }

        const draft = !isFinalDocumentStatus(documentStatus);
        for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
          const slice = slices[pageIndex];
          if (!slice) continue;
          const { start, end } = slice;
          const sliceHeight = Math.max(1, end - start);
         const pageCanvas = document.createElement("canvas");
         pageCanvas.width = canvas.width;
         pageCanvas.height = sliceHeight;
         const context = pageCanvas.getContext("2d");
         if (!context) throw new Error("PDF rendering is unavailable in this browser");
         context.fillStyle = "#ffffff";
         context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          context.drawImage(canvas, 0, start, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          if (pageIndex > 0) pdf.addPage();
         const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
          pdf.addImage(
            pageCanvas.toDataURL("image/jpeg", 0.92),
            "JPEG",
            PDF_PAGE.marginMm,
            PDF_PAGE.marginMm,
            pageWidth,
            renderedHeight,
            undefined,
            "MEDIUM",
          );

          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.25);
          pdf.rect(PDF_PAGE.marginMm, PDF_PAGE.marginMm, pageWidth, pageHeight);

          if (draft) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(48);
            pdf.setTextColor(210, 210, 210);
            pdf.text("DRAFT", PDF_PAGE.widthMm / 2, PDF_PAGE.heightMm / 2, {
              align: "center",
              angle: 45,
            });
          }

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          pdf.text(
            `ENFA No. ${doc.nfaNo || "Draft"} – ${pageIndex + 1} of ${slices.length}`,
            PDF_PAGE.widthMm - PDF_PAGE.marginMm,
            PDF_PAGE.footerBaselineMm,
            { align: "right" },
          );
       }
      pdf.save(`ENFA-${doc.nfaNo || "draft"}.pdf`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      toast.error(detail ? `Could not generate the PDF: ${detail}` : "Could not generate the PDF");
    } finally {
      element.classList.remove("enfa-pdf-export");
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
