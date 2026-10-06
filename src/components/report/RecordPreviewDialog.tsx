import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { Printer, Download, Loader2, ExternalLink } from "lucide-react";
import { EnfaPreviewUnavailableError, fetchEnfaPreviewPdf } from "@/lib/enfa-preview-pdf";
import { EnfaDocument, type EnfaDocumentProps } from "@/components/document/EnfaDocument";
import { choosePreviewSource } from "@/lib/enfa-preview-source";
import { loadSapPreviewDetail } from "@/lib/enfa-preview-detail";
import { safeApprovalDetailMessage } from "@/lib/approval-print-document";
import { createPrintFormPdf, downloadPrintFormPdf } from "@/lib/print-form-pdf";

export function RecordPreviewDialog({
  row,
  open,
  onOpenChange,
  endpoint = "report",
  detailEndpoint = endpoint,
}: {
  row: SapReportRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  endpoint?: "report" | "select";
  detailEndpoint?: "report" | "select";
}) {
  const enfa = row?.REFFLD ?? "";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const [descriptionForm, setDescriptionForm] = useState<EnfaDocumentProps | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  // Fetch the printable document from SAP for the selected record.
  useEffect(() => {
    if (!open || !enfa) return;
    let cancelled = false;
    let url: string | null = null;
    const controller = new AbortController();
    let pdfDocument: { destroy: () => Promise<void> } | null = null;
    setPdfError(null);
    setPdfUrl(null);
    setDescriptionForm(null);
    if (pagesRef.current) pagesRef.current.replaceChildren();
    setPdfLoading(true);
    (async () => {
      try {
        const pdf = await fetchEnfaPreviewPdf(enfa, endpoint === "select" ? "edit" : "report", controller.signal);
        if (cancelled) return;
        const bytes = pdf.bytes;
        url = URL.createObjectURL(pdf.blob);

        // Chrome's PDF plugin is blocked inside embedded/sandboxed frames, so
        // the pages are rendered to canvas with pdf.js instead of an <iframe>.
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const loadingTask = pdfjs.getDocument({ data: bytes });
        pdfDocument = loadingTask;
        if (cancelled) { await loadingTask.destroy(); return; }
        const doc = await loadingTask.promise;
        if (cancelled) return;

        const host = pagesRef.current;
        const width = Math.min(host?.clientWidth || 800, 900);
        const frag = document.createDocumentFragment();
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * (window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "rounded-lg border border-border bg-card";
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
          frag.appendChild(canvas);
        }
        if (cancelled) return;
        if (pagesRef.current) {
          pagesRef.current.innerHTML = "";
          pagesRef.current.appendChild(frag);
        }
        setPdfUrl(url);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof EnfaPreviewUnavailableError && e.documentAbsent) {
          try {
            const detail = await loadSapPreviewDetail(enfa, detailEndpoint, { ...row }, controller.signal);
            if (cancelled) return;
            if (choosePreviewSource({ documentAvailable: false, documentAbsent: true, description: detail?.descriptionHtml }) === "description") {
              setDescriptionForm(detail);
            } else {
              // Neither SAP source exists: retain the existing Preview response.
              setPdfError(e.message);
            }
          } catch (detailError) {
            if (!cancelled) setPdfError(safeApprovalDetailMessage(detailError instanceof Error ? detailError.message : "SAP record details are temporarily unavailable"));
          }
        } else {
          setPdfError(safeApprovalDetailMessage(e instanceof Error ? e.message : "SAP preview failed"));
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      void pdfDocument?.destroy();
    };
  }, [open, enfa, endpoint, detailEndpoint, row]);

  async function downloadDescription() {
    if (!descriptionRef.current || downloadBusy) return;
    setDownloadBusy(true);
    try {
      const pdf = await createPrintFormPdf(descriptionRef.current, { nfaNo: enfa });
      downloadPrintFormPdf(pdf);
    } catch {
      setPdfError("The document could not be downloaded. Please try again.");
    } finally {
      setDownloadBusy(false);
    }
  }

  const printPdf = () => {
    if (pdfUrl) {
      const w = window.open(pdfUrl, "_blank");
      if (w) {
        w.addEventListener("load", () => w.print(), { once: true });
        return;
      }
    }
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Preview · {enfa || "—"}</DialogTitle>
          <DialogDescription className="sr-only">Preview the selected eNFA SAP document.</DialogDescription>
        </DialogHeader>

        <div id="enfa-preview" className="space-y-5">
          {pdfLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching the document from SAP…
            </div>
          ) : null}

          <div
            ref={pagesRef}
            className={pdfUrl && !pdfLoading ? "flex max-h-[70vh] flex-col gap-3 overflow-y-auto" : "hidden"}
          />

          {!pdfLoading && descriptionForm ? (
            <div ref={descriptionRef} className="enfa-print-area max-h-[70vh] overflow-y-auto">
              <EnfaDocument {...descriptionForm} />
            </div>
          ) : null}

          {!pdfLoading && !pdfUrl ? (
            <>
              {pdfError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {pdfError}
                </p>
              ) : null}
            </>
          ) : null}

        </div>

        <DialogFooter>
          {descriptionForm && !pdfLoading ? (
            <Button variant="outline" className="gap-1.5" disabled={downloadBusy} onClick={() => void downloadDescription()}>
              {downloadBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
            </Button>
          ) : null}
          {pdfUrl ? (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => window.open(pdfUrl, "_blank", "noopener")}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </Button>
              <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                const a = document.createElement("a");
                a.href = pdfUrl;
                a.download = `ENFA-${enfa || "document"}.pdf`;
                a.click();
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            </>
          ) : null}
          <Button variant="outline" className="gap-1.5" onClick={printPdf}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
