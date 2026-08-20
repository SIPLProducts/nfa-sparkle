import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextView } from "@/components/RichTextView";
import { PLANTS, COMPANIES } from "@/lib/sap/master";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { Printer, Download, Loader2, ExternalLink } from "lucide-react";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

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
  const [draft, setDraft] = useState<{
    scope_impact: string | null;
    budget_impact: number | null;
    timeline_days: number | null;
    detailed_description: string | null;
    subject: string | null;
  } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !enfa) return;
    let cancelled = false;
    (async () => {
      const { data: d } = await supabase
        .from("sap_record_draft")
        .select("subject, scope_impact, budget_impact, timeline_days, detailed_description")
        .eq("enfa_number", enfa)
        .maybeSingle();
      if (cancelled) return;
      setDraft(d ?? null);
    })();
    return () => { cancelled = true; };
  }, [open, enfa]);

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
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? "";
        const res = await fetch("/api/public/enfa-print", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            PRINT: { EFNA_NO: enfa },
            ...(endpoint === "select" ? { variant: "edit" } : {}),
          }),
        });
        const json = await res.json().catch(() => ({}) as any);
        if (cancelled) return;
        if (!res.ok || !json?.base64) {
          setPdfError(json?.error ?? `SAP preview failed (HTTP ${res.status})`);
          return;
        }
        const bin = atob(json.base64 as string);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes.slice()], { type: json.mime || "application/pdf" }));

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

  const plant = PLANTS.find((p) => p.code === (row?.PSPNR ?? ""));
  const company = COMPANIES.find((c) => c.code === plant?.company);

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

          {pdfUrl ? null : (
          <>
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-display text-sm font-bold">NFA Details</h3>
            <Row label="ENFA Number" value={enfa} />
            <Row label="Company" value={company ? `${company.code} – ${company.name}` : ""} />
            <Row label="Plant" value={[row?.PSPNR, row?.NAME1].filter(Boolean).join(" – ")} />
            <Row label="NFA Type" value={row?.FUNCT_TXT ?? ""} />
            <Row label="Function" value={row?.EXTR_TXT ?? ""} />
            <Row label="Subject" value={draft?.subject || row?.SUBJECT || ""} />
            <Row label="Initiator" value={row?.INIT_NAME ?? ""} />
            <Row label="Creation Date" value={row?.BEGDA ?? ""} />
            <Row label="Status" value={row?.STATUS_TXT ?? ""} />
            <Row label="Scope Impact" value={draft?.scope_impact ?? ""} />
            <Row label="Budget Impact" value={draft?.budget_impact != null ? String(draft.budget_impact) : ""} />
            <Row label="Timeline Impact" value={draft?.timeline_days != null ? `${draft.timeline_days} days` : ""} />
          </section>

          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-display text-sm font-bold">Approval Ladder</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Level</th>
                  <th className="py-1.5 font-medium">Designation</th>
                  <th className="py-1.5 font-medium">Approver</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {LEVELS.map((l) => {
                  const role = row?.[`ROLE${l}` as keyof SapReportRow] as string | undefined;
                  const appr = row?.[`APPR${l}` as keyof SapReportRow] as string | undefined;
                  const stat = row?.[`STAT${l}` as keyof SapReportRow] as string | undefined;
                  if (!role && !appr && !stat) return null;
                  return (
                    <tr key={l}>
                      <td className="py-1.5 pr-2">L{l}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{role || "—"}</td>
                      <td className="py-1.5 pr-2">{appr || "—"}</td>
                      <td className="py-1.5">{stat || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {draft?.detailed_description ? (
            <section className="rounded-lg border border-border p-4">
              <h3 className="mb-2 font-display text-sm font-bold">Detailed Description</h3>
              <RichTextView html={draft.detailed_description} />
            </section>
          ) : null}
          </>
          )}
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
