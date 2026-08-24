import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

interface SapFileMeta {
  index: number;
  filename: string;
  mime: string;
  size: number;
}

async function authToken() {
  const { data: sess } = await supabase.auth.getSession();
  return sess.session?.access_token ?? "";
}

/** Live documents attached to the eNFA in SAP (endpoint configured in Admin → SAP API Settings). */
function useSapDocuments(enfaNumber: string | null, endpoint: "report" | "my") {
  const [docs, setDocs] = useState<SapFileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enfaNumber) {
      setDocs([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const forceRefresh = refreshingRef.current;
    refreshingRef.current = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await authToken();
        const res = await fetch("/api/public/enfa-attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            attachment: { reffld: enfaNumber },
            endpoint,
            mode: "list",
            ...(forceRefresh ? { refresh: true } : {}),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          files?: SapFileMeta[];
          error?: string;
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setDocs([]);
          setError(json?.error ?? `SAP attachments failed (HTTP ${res.status})`);
          return;
        }
        setDocs(Array.isArray(json.files) ? json.files : []);
        setError(json.files?.length ? null : (json.message ?? null));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "SAP attachments failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enfaNumber, endpoint, nonce]);

  const refresh = useCallback((force = false) => {
    if (force) refreshingRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  return { docs, loading, error, refresh };
}

/** Fetches one document's base64 content on demand (served from the server-side SAP cache). */
async function fetchSapDocContent(
  enfaNumber: string,
  endpoint: "report" | "my",
  index: number,
): Promise<{ filename: string; mime: string; base64: string }> {
  const token = await authToken();
  const res = await fetch("/api/public/enfa-attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ attachment: { reffld: enfaNumber }, endpoint, mode: "content", index }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    file?: { filename: string; mime: string; base64: string };
    error?: string;
  };
  if (!res.ok || !json.file) throw new Error(json?.error ?? `Could not load the document (HTTP ${res.status})`);
  return json.file;
}

function base64ToBlobUrl(base64: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  const CHUNK = 32768;
  for (let start = 0; start < bin.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bin.length);
    for (let i = start; i < end; i++) bytes[i] = bin.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime || "application/octet-stream" }));
}


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const res = String(reader.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/** Sends the picked files to SAP through the registered "Upload Document" endpoint. */
export async function uploadToSap(
  enfaNumber: string,
  files: File[],
  endpoint: "report" | "my" = "report",
): Promise<string> {
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    throw new Error(`Total upload size is ${(total / 1024 / 1024).toFixed(1)} MB — the limit is 40 MB per upload.`);
  }
  const payloadFiles = await Promise.all(
    files.map(async (f) => ({ file_name: f.name, file: await fileToBase64(f) })),
  );
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? "";
  const res = await fetch("/api/public/enfa-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ upload: { reffld: enfaNumber, file: payloadFiles }, endpoint }),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string; enfaNo?: string };
  if (!res.ok) throw new Error(json?.error ?? `SAP upload failed (HTTP ${res.status})`);
  return json.message ?? `Uploaded to SAP against ENFA ${json.enfaNo ?? enfaNumber}`;
}

type DocKind = "pdf" | "image" | "docx" | "sheet" | "text" | "none";

function resolveKind(mime: string, name: string): DocKind {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return "image";
  if (m.includes("wordprocessingml") || n.endsWith(".docx")) return "docx";
  if (m.includes("spreadsheetml") || m.includes("ms-excel") || m === "text/csv" || /\.(xlsx|xlsm|xls|csv)$/.test(n))
    return "sheet";
  if (m.startsWith("text/") || m === "application/json" || m === "application/xml" || /\.(txt|json|xml|log|md)$/.test(n))
    return "text";
  return "none";
}

/** Strips scripts, inline handlers and javascript: URLs from HTML produced out of a SAP-sourced file. */
function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const an = attr.name.toLowerCase();
      const av = attr.value.trim().toLowerCase();
      if (an.startsWith("on")) el.removeAttribute(attr.name);
      else if ((an === "href" || an === "src") && av.startsWith("javascript:")) el.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

function SapDocViewer({ url, mime, name }: { url: string; mime: string; name: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [sheets, setSheets] = useState<{ name: string; html: string }[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const kind = resolveKind(mime, name);
  const isPdf = kind === "pdf";

  useEffect(() => {
    setErr(null);
    setHtml(null);
    setText(null);
    setSheets(null);
    setActiveSheet(0);
  }, [url]);

  useEffect(() => {
    if (kind === "image" || kind === "none") return;
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        if (cancelled) return;

        if (kind === "text") {
          setText(new TextDecoder().decode(bytes));
          return;
        }

        if (kind === "docx") {
          const mod = (await import("mammoth/mammoth.browser" as any)) as any;
          const mammoth = mod?.convertToHtml ? mod : mod?.default;
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(0) });
          if (cancelled) return;
          setHtml(sanitizeHtml(result?.value || "<p>(empty document)</p>"));
          return;
        }

        if (kind === "sheet") {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(bytes, { type: "array" });
          if (cancelled) return;
          setSheets(
            wb.SheetNames.map((sn) => ({
              name: sn,
              html: sanitizeHtml(XLSX.utils.sheet_to_html(wb.Sheets[sn]!, { editable: false })),
            })),
          );
          return;
        }

        // pdf
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        const host = hostRef.current;
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
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        hostRef.current.appendChild(frag);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not render this document");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  const downloadFallback = (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      {err ? <span className="text-destructive">{err}</span> : null}
      <span>This file type cannot be previewed in the browser — it can still be downloaded.</span>
      <Button asChild size="sm" variant="outline">
        <a href={url} download={name}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download
        </a>
      </Button>
    </div>
  );

  if (kind === "image") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (kind === "none" || (err && !isPdf)) return downloadFallback;

  if (kind === "text") {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-xs text-foreground">
          {text ?? "Loading…"}
        </pre>
      </div>
    );
  }

  if (kind === "docx") {
    return (
      <div className="h-full overflow-auto p-4">
        {html === null ? (
          <p className="text-sm text-muted-foreground">Loading document…</p>
        ) : (
          <div
            className="sap-doc-html mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 text-sm leading-relaxed text-foreground [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    );
  }

  if (kind === "sheet") {
    return (
      <div className="flex h-full flex-col">
        {sheets && sheets.length > 1 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
            {sheets.map((s, i) => (
              <Button
                key={s.name}
                size="sm"
                variant={i === activeSheet ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setActiveSheet(i)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex-1 overflow-auto p-4">
          {sheets === null ? (
            <p className="text-sm text-muted-foreground">Loading spreadsheet…</p>
          ) : (
            <div
              className="overflow-auto rounded-lg border border-border bg-card text-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1"
              dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html ?? "" }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <div ref={hostRef} className="flex flex-col gap-3" />
    </div>
  );
}

export function RecordAttachmentsDialog({
  enfaNumber,
  open,
  onOpenChange,
  endpoint = "report",
}: {
  enfaNumber: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  endpoint?: "report" | "my";
}) {
  const {
    docs: sapDocs,
    loading: sapLoading,
    error: sapError,
    refresh: refreshSap,
  } = useSapDocuments(open ? enfaNumber : null, endpoint);
  const [sapPreview, setSapPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length || !enfaNumber) return;
    setBusy(true);
    try {
      const message = await uploadToSap(enfaNumber, list, endpoint);
      toast.success(message);
      refreshSap();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openSapDoc(d: SapFile, download = false) {
    const url = base64ToBlobUrl(d.base64, d.mime);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = d.filename || "document";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return;
    }
    setSapPreview({ name: d.filename, url, mime: d.mime });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <Paperclip className="h-4 w-4" /> Attached Docs · {enfaNumber ?? "—"}
            </DialogTitle>
          </DialogHeader>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                SAP documents
              </h4>
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload File"}
              </Button>
              <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
            </div>
            {sapLoading ? (
              <p className="flex items-center gap-2 rounded-md border border-border px-3 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching documents from SAP…
              </p>
            ) : sapDocs.length ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {sapDocs.map((d, i) => (
                  <li key={`${d.filename}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{d.filename}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {d.mime} · {Math.round((d.base64.length * 3) / 4 / 1024)} KB · from SAP
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openSapDoc(d)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openSapDoc(d, true)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className={
                  sapError
                    ? "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-destructive"
                    : "rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground"
                }
              >
                {sapError ?? "No documents attached to this eNFA in SAP."}
              </p>
            )}
          </section>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sapPreview}
        onOpenChange={(o) => {
          if (!o && sapPreview) {
            URL.revokeObjectURL(sapPreview.url);
            setSapPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="truncate font-display text-sm">{sapPreview?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh] w-full bg-muted/30">
            {sapPreview ? (
              <SapDocViewer url={sapPreview.url} mime={sapPreview.mime} name={sapPreview.name} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
