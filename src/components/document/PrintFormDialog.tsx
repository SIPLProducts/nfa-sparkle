import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Pencil, Printer, Save } from "lucide-react";
import { EnfaDocument, type EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(doc.descriptionHtml ?? "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) setEditing(false);
    setDescription(doc.descriptionHtml ?? "");
  }, [doc.descriptionHtml, open]);

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
            <Button variant="outline" className="gap-1.5" onClick={() => void downloadPdf()} disabled={downloading}>
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PDF
            </Button>
          )}
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
