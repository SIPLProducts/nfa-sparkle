import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { Printer, Download, Loader2, ExternalLink } from "lucide-react";
import { fetchEnfaPreviewPdf } from "@/lib/enfa-preview-pdf";



function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="break-words">{value || "—"}</span>
    </div>
  );
}

export function RecordPreviewDialog({
  row,
  open,
  onOpenChange,
  endpoint = "report",
}: {
  row: SapReportRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  endpoint?: "report" | "select";
}) {
  const enfa = row?.REFFLD ?? "";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);

  // Fetch the printable document from SAP for the selected record.
  useEffect(() => {
    if (!open || !enfa) return;
    let cancelled = false;
    let url: string | null = null;
    setPdfError(null);
    setPdfUrl(null);
    setPdfLoading(true);
    (async () => {
      try {
        const pdf = await fetchEnfaPreviewPdf(enfa, endpoint === "select" ? "edit" : "report");
        if (cancelled) return;
        const bytes = pdf.bytes;
        url = URL.createObjectURL(pdf.blob);

        // Chrome's PDF plugin is blocked inside embedded/sandboxed frames, so
        // the pages are rendered to canvas with pdf.js instead of an <iframe>.
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
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
          canvas.className = "rounded-lg border border-border bg-white";
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
        if (!cancelled) setPdfError(e instanceof Error ? e.message : "SAP preview failed");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, enfa, endpoint]);

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

          {!pdfLoading && !pdfUrl ? (
            <>
              {pdfError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {pdfError} — showing the local summary instead.
                </p>
              ) : null}
            </>
          ) : null}

        </div>

        <DialogFooter>
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
