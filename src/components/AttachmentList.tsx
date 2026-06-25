import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Eye, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface Attachment {
  id: string;
  nfa_id: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
  uploaded_by: string;
}

interface Props {
  nfaId: string;
  /** External refresh trigger — bump to refetch. */
  refreshKey?: number;
  title?: string;
  emptyText?: string;
  className?: string;
}

export function AttachmentList({ nfaId, refreshKey = 0, title = "Supporting Attachments", emptyText = "No attachments uploaded yet.", className }: Props) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ att: Attachment; url: string; kind: "pdf" | "image" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("nfa_attachment")
        .select("*")
        .eq("nfa_id", nfaId)
        .order("uploaded_at", { ascending: false });
      if (!cancelled) {
        if (error) toast.error(error.message);
        setFiles((data as Attachment[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nfaId, refreshKey]);

  function previewKind(att: Attachment): "pdf" | "image" | null {
    const mime = (att.mime || "").toLowerCase();
    const name = att.filename.toLowerCase();
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return "image";
    return null;
  }

  async function open(att: Attachment, download = false) {
    const { data, error } = await supabase.storage
      .from("nfa-attachments")
      .createSignedUrl(att.storage_path, 300, download ? { download: att.filename } : undefined);
    if (error || !data) return toast.error(error?.message ?? "Cannot open file");
    if (download) {
      window.open(data.signedUrl, "_blank");
      return;
    }
    const kind = previewKind(att);
    if (kind) {
      setPreview({ att, url: data.signedUrl, kind });
    } else {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <section className={"overflow-hidden rounded-lg border border-border bg-card shadow-sm " + (className ?? "")}>
      <header className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold leading-tight">
          <Paperclip className="h-4 w-4" /> {title}
        </h2>
        <span className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"}</span>
      </header>
      <div className="p-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading attachments…</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{f.filename}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.mime || "file"}
                      {f.size ? ` · ${(f.size / 1024).toFixed(1)} KB` : ""}
                      {f.uploaded_at ? ` · ${new Date(f.uploaded_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => open(f, false)}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => open(f, true)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl p-0">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-display">{preview?.att.filename}</span>
              {preview ? (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => open(preview.att, true)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[75vh] w-full bg-muted/30">
            {preview?.kind === "pdf" ? (
              <iframe src={preview.url} title={preview.att.filename} className="h-full w-full" />
            ) : preview?.kind === "image" ? (
              <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
                <img src={preview.url} alt={preview.att.filename} className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}