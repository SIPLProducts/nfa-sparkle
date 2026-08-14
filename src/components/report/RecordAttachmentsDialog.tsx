import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface SapAttachment {
  id: string;
  enfa_number: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
  uploaded_by: string;
}

const BUCKET = "nfa-attachments";

export function useSapAttachments(enfaNumber: string | null) {
  const [files, setFiles] = useState<SapAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enfaNumber) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sap_attachment")
      .select("*")
      .eq("enfa_number", enfaNumber)
      .order("uploaded_at", { ascending: false });
    if (error) toast.error(error.message);
    setFiles((data as SapAttachment[]) ?? []);
    setLoading(false);
  }, [enfaNumber]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { files, loading, refresh };
}

export async function uploadSapFile(enfaNumber: string, file: File) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("You must be signed in to upload");
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `sap/${enfaNumber}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase.from("sap_attachment").insert({
    enfa_number: enfaNumber,
    storage_path: path,
    filename: file.name,
    mime: file.type || null,
    size: file.size,
    uploaded_by: u.user.id,
  });
  if (error) throw new Error(error.message);
}

function previewKind(f: SapAttachment): "pdf" | "image" | null {
  const mime = (f.mime || "").toLowerCase();
  const name = f.filename.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return "image";
  return null;
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
  const { files, loading, refresh } = useSapAttachments(open ? enfaNumber : null);
  const [preview, setPreview] = useState<{ f: SapAttachment; url: string; kind: "pdf" | "image" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function openFile(f: SapAttachment, download = false) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 300, download ? { download: f.filename } : undefined);
    if (error || !data) return toast.error(error?.message ?? "Cannot open file");
    const kind = previewKind(f);
    if (download || !kind) return void window.open(data.signedUrl, "_blank");
    setPreview({ f, url: data.signedUrl, kind });
  }

  async function remove(f: SapAttachment) {
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    const { error } = await supabase.from("sap_attachment").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Attachment removed");
    void refresh();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length || !enfaNumber) return;
    setBusy(true);
    try {
      for (const file of list) await uploadSapFile(enfaNumber, file);
      toast.success(`${list.length} file${list.length === 1 ? "" : "s"} uploaded`);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <Paperclip className="h-4 w-4" /> Attached Docs · {enfaNumber ?? "—"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {files.length} file{files.length === 1 ? "" : "s"} attached to this ENFA
            </span>
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload File"}
            </Button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : files.length === 0 ? (
              <p className="rounded-md border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                No documents attached yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{f.filename}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {f.mime || "file"}
                          {f.size ? ` · ${(f.size / 1024).toFixed(1)} KB` : ""}
                          {f.uploaded_at ? ` · ${new Date(f.uploaded_at).toLocaleString()}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openFile(f)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openFile(f, true)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Remove" onClick={() => remove(f)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
