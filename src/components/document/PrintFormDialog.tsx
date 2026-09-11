import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileDown, FileUp, Loader2, Pencil, Printer, Save } from "lucide-react";
import { EnfaDocument, type EnfaDocumentProps } from "@/components/document/EnfaDocument";
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

export interface PrintFormDialogProps extends EnfaDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  onDescriptionChange?: (html: string) => void;
  onSaved?: (html: string) => void;
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

  async function logoBase64(): Promise<string | undefined> {
    try {
      const response = await fetch("/ramky-logo.png");
      const blob = await response.blob();
      return await fileToBase64(blob);
    } catch {
      return undefined;
    }
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
          approvers: doc.approvers,
          comments: doc.comments,
          logoBase64: await logoBase64(),
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
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 186;
      const pageHeight = 273;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remaining = imageHeight;
      let offset = 0;
      const image = canvas.toDataURL("image/png");
      pdf.addImage(image, "PNG", 12, 12, pageWidth, imageHeight);
      remaining -= pageHeight;
      while (remaining > 0) {
        offset -= pageHeight;
        pdf.addPage();
        pdf.addImage(image, "PNG", 12, 12 + offset, pageWidth, imageHeight);
        remaining -= pageHeight;
      }
      pdf.save(`ENFA-${doc.nfaNo || "draft"}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Print Form · {doc.nfaNo || "—"}</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="enfa-print-area max-h-[70vh] overflow-y-auto bg-white p-2">
          <EnfaDocument
            {...doc}
            descriptionHtml={description}
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
                  <Button variant="outline" className="gap-1.5" onClick={() => void createOrDownloadDocx()} disabled={docxBusy}>
                    {docxBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Download DOCX
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => uploadRef.current?.click()} disabled={docxBusy}>
                    <FileUp className="h-3.5 w-3.5" /> Upload Revised DOCX
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="gap-1.5" onClick={() => void downloadPdf()} disabled={downloading}>
                  {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PDF
                </Button>
              )}
            </>
          )}
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
