import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

interface SapFile {
  filename: string;
  base64: string;
  mime: string;
}

/** Live documents attached to the eNFA in SAP (endpoint configured in Admin → SAP API Settings). */
function useSapDocuments(enfaNumber: string | null) {
  const [docs, setDocs] = useState<SapFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enfaNumber) {
      setDocs([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? "";
        const res = await fetch("/api/public/enfa-attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ attachment: { reffld: enfaNumber } }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          files?: SapFile[];
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
  }, [enfaNumber, nonce]);

  return { docs, loading, error, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

function base64ToBlobUrl(base64: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes.slice()], { type: mime || "application/octet-stream" }));
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
export async function uploadToSap(enfaNumber: string, files: File[]): Promise<string> {
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
    body: JSON.stringify({ upload: { reffld: enfaNumber, file: payloadFiles } }),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string; enfaNo?: string };
  if (!res.ok) throw new Error(json?.error ?? `SAP upload failed (HTTP ${res.status})`);
  return json.message ?? `Uploaded to SAP against ENFA ${json.enfaNo ?? enfaNumber}`;
}

function SapDocViewer({ url, mime, name }: { url: string; mime: string; name: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
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
  }, [url, isPdf]);

  if (isImage) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (!isPdf) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
        This file type cannot be previewed in the browser.
        <Button asChild size="sm" variant="outline">
          <a href={url} download={name}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
          </a>
        </Button>
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
}: {
  enfaNumber: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const {
    docs: sapDocs,
    loading: sapLoading,
    error: sapError,
    refresh: refreshSap,
  } = useSapDocuments(open ? enfaNumber : null);
  const [sapPreview, setSapPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length || !enfaNumber) return;
    setBusy(true);
    try {
      const message = await uploadToSap(enfaNumber, list);
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

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="truncate font-display text-sm">{preview?.f.filename}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh] w-full bg-muted/30">
            {preview?.kind === "pdf" ? (
              <iframe src={preview.url} title={preview.f.filename} className="h-full w-full" />
            ) : preview?.kind === "image" ? (
              <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
                <img src={preview.url} alt={preview.f.filename} className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
