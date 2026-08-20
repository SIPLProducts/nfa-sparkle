import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { PlusCircle, Search, FileText, Upload, Paperclip, Eye, Pencil, RefreshCw } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { toast } from "sonner";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { RecordAttachmentsDialog, uploadToSap } from "@/components/report/RecordAttachmentsDialog";
import { RecordEditDialog } from "@/components/report/RecordEditDialog";
import { RecordPreviewDialog } from "@/components/report/RecordPreviewDialog";

export const Route = createFileRoute("/_authed/nfa/my")({
  component: MyNfas,
});

/** Normalises SAP's response into upper-cased string rows. */
function normaliseRows(value: unknown): SapReportRow[] {
  let v = value;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    for (const k of ["body", "data", "ITEMS", "items", "result", "RESULT"]) {
      if (Array.isArray(obj[k])) { v = obj[k]; break; }
    }
  }
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[]).map((r) => {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(r)) out[k.trim().toUpperCase()] = val == null ? "" : String(val);
    return out as unknown as SapReportRow;
  });
}

/** Derives a badge tone from whatever status text SAP returns — no fixed list. */
function statusTone(text: string): string {
  const s = (text || "").toLowerCase();
  if (s.includes("reject")) return "bg-destructive/10 text-destructive";
  if (s.includes("approve") || s.includes("complete") || s.includes("closed")) return "bg-emerald-500/10 text-emerald-600";
  if (s.includes("clarif") || s.includes("initiator") || s.includes("back")) return "bg-amber-500/10 text-amber-600";
  if (s.includes("process") || s.includes("pending") || s.includes("with")) return "bg-sky-500/10 text-sky-600";
  return "bg-muted text-muted-foreground";
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

function val(row: SapReportRow, key: string): string {
  return ((row as unknown as Record<string, string>)[key] ?? "").trim();
}

function MyNfas() {
  const [rows, setRows] = useState<SapReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const res = await fetch("/api/public/enfa-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ report: "" }),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

      if (!res.ok) {
        const msg =
          (parsed && typeof parsed === "object" && (parsed as any).error) ||
          `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`;
        setRows([]);
        setError(String(msg));
        toast.error(String(msg));
        return;
      }
      setRows(normaliseRows(parsed));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach SAP";
      setRows([]);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      val(r, "REFFLD").toLowerCase().includes(s) ||
      val(r, "SUBJECT").toLowerCase().includes(s) ||
      val(r, "FUNCT_TXT").toLowerCase().includes(s) ||
      val(r, "NAME1").toLowerCase().includes(s),
    );
  }, [q, rows]);

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(filtered.length, 10, 10);
  const visible = filtered.slice(0, visibleCount);

  const selectedRow = selected !== null ? filtered[selected] ?? null : null;
  const selectedEnfaNo = selectedRow ? val(selectedRow, "REFFLD") : "";

  function requireSelection() {
    if (!selectedRow) {
      toast.info("Select a record first.");
      return false;
    }
    if (!selectedEnfaNo) {
      toast.info("This record does not have an eNFA number in SAP.");
      return false;
    }
    return true;
  }

  async function onUploadPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length || !selectedEnfaNo) return;
    setUploading(true);
    try {
      toast.success(await uploadToSap(selectedEnfaNo, list));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const emptyText = error
    ? error
    : q
      ? "Try a different search."
      : "SAP returned no records.";

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="My NFAs"
        subtitle="NFAs you have initiated — track status across the approver chain."
        actions={
          <>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ENFA #, subject…" className="h-9 w-full pl-9 sm:w-64" />
            </div>
            <Link to="/nfa/new" className="shrink-0"><Button size="sm" className="gap-1.5"><PlusCircle className="h-4 w-4" /> New NFA</Button></Link>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
          {selectedEnfaNo ? <span className="ml-2 font-mono text-xs text-accent">{selectedEnfaNo}</span> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => requireSelection() && uploadRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload File, If Any"}
          </Button>
          <input ref={uploadRef} type="file" multiple className="hidden" onChange={onUploadPick} />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requireSelection() && setDocsOpen(true)}>
            <Paperclip className="h-3.5 w-3.5" /> Attached Docs
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requireSelection() && setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => requireSelection() && setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-2.5 md:hidden">
        {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
            <div className="text-sm font-medium">No NFAs found</div>
            <div className="text-xs text-muted-foreground">{emptyText}</div>
          </div>
        )}
        {visible.map((r, i) => {
          const status = val(r, "STATUS_TXT");
          return (
            <button
              key={`${val(r, "REFFLD")}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              className={"block w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm active:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="my-nfa-record"
                    className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                    checked={selected === i}
                    onChange={() => setSelected(i)}
                    aria-label={`Select ${val(r, "REFFLD")}`}
                  />
                  <span className="font-mono text-[11px] font-semibold text-accent">{val(r, "REFFLD") || "—"}</span>
                </span>
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + statusTone(status)}>{status || "—"}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{val(r, "SUBJECT") || "—"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {val(r, "FUNCT_TXT") || "—"} · {val(r, "PSPNR") || "—"} · {val(r, "BEGDA") || "—"}
              </div>
            </button>
          );
        })}
        {hasMore && (
          <div ref={setSentinel} className="py-3 text-center text-[11px] text-muted-foreground">
            Loading more… <span className="text-foreground/60">({visibleCount} of {filtered.length})</span>
          </div>
        )}
        {!loading && filtered.length > 0 && !hasMore && filtered.length > 10 && (
          <div className="py-3 text-center text-[11px] text-muted-foreground">All {filtered.length} loaded</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th> </Th>
                <Th>ENFA Number</Th><Th>Status</Th><Th>Plant</Th><Th>NFA Type</Th><Th>Subject</Th><Th>Created</Th>
                {LEVELS.map((l) => (<Th key={`s${l}`}>{`L${l}`}</Th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={20}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={20} className="px-4 py-12 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <div className="text-sm font-medium">No NFAs found</div>
                  <div className="text-xs text-muted-foreground">{emptyText}</div>
                </td></tr>
              )}
              {filtered.map((r, i) => {
                const status = val(r, "STATUS_TXT");
                const plant = [val(r, "PSPNR"), val(r, "NAME1")].filter(Boolean).join(" · ");
                return (
                  <tr
                    key={`${val(r, "REFFLD")}-${i}`}
                    onClick={() => setSelected(i)}
                    className={"cursor-pointer hover:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
                  >
                    <Td>
                      <input
                        type="radio"
                        name="my-nfa-record-desktop"
                        className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                        checked={selected === i}
                        onChange={() => setSelected(i)}
                        aria-label={`Select ${val(r, "REFFLD")}`}
                      />
                    </Td>
                    <Td><span className="font-mono text-xs font-medium text-accent">{val(r, "REFFLD") || "—"}</span></Td>
                    <Td><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + statusTone(status)}>{status || "—"}</span></Td>
                    <Td className="text-muted-foreground">{plant || "—"}</Td>
                    <Td>{val(r, "FUNCT_TXT") || "—"}</Td>
                    <Td className="max-w-[280px] truncate">{val(r, "SUBJECT") || "—"}</Td>
                    <Td className="text-muted-foreground">{val(r, "BEGDA") || "—"}</Td>
                    {LEVELS.map((l) => {
                      const who = val(r, `APPR${l}`);
                      const st = val(r, `STAT${l}`);
                      return (
                        <Td key={`s${l}`}>
                          {who || st ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate text-xs">{who || "—"}</span>
                              {st ? <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + statusTone(st)}>{st}</span> : null}
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </Td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <RecordAttachmentsDialog enfaNumber={selectedEnfaNo || null} open={docsOpen} onOpenChange={setDocsOpen} />
      <RecordEditDialog row={selectedRow} endpoint="select" open={editOpen} onOpenChange={setEditOpen} />
      <RecordPreviewDialog row={selectedRow} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 whitespace-nowrap font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 whitespace-nowrap " + className}>{children}</td>;
}
