import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, Eye, FileText, HelpCircle, Paperclip, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { toast } from "sonner";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { RecordAttachmentsDialog } from "@/components/report/RecordAttachmentsDialog";
import { RecordPreviewDialog } from "@/components/report/RecordPreviewDialog";
import { ApprovalAction, ApprovalCommentDialog } from "@/components/ApprovalCommentDialog";

export const Route = createFileRoute("/_authed/approvals")({
  component: ApprovalsInbox,
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

/** Derives a badge tone from whatever status text SAP returns. */
function statusTone(text: string): string {
  const s = (text || "").toLowerCase();
  if (s.includes("reject")) return "bg-destructive/10 text-destructive";
  if (s.includes("approve") || s.includes("complete") || s.includes("closed")) return "bg-success/10 text-success";
  if (s.includes("clarif") || s.includes("initiator") || s.includes("back")) return "bg-accent/10 text-accent";
  if (s.includes("process") || s.includes("pending") || s.includes("with")) return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

function val(row: SapReportRow, key: string): string {
  return ((row as unknown as Record<string, string>)[key] ?? "").trim();
}

/** NFA Type: FUNCT_TXT when present, else FUNCT (as in the get_data response). */
function nfaType(row: SapReportRow): string {
  return val(row, "FUNCT_TXT") || val(row, "FUNCT") || "—";
}

/** Finds the total number of approval levels present in the row. */
function totalLevels(row: SapReportRow): number {
  let count = 0;
  for (const l of LEVELS) {
    if (val(row, `APPR${l}`)) count = l;
  }
  return count || 1;
}

/** Finds the current pending level based on empty statuses. */
function currentLevel(row: SapReportRow): number {
  for (const l of LEVELS) {
    if (!val(row, `STAT${l}`)) return l;
  }
  return totalLevels(row);
}

function ApprovalsInbox() {
  
  const [rows, setRows] = useState<SapReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [commentAction, setCommentAction] = useState<ApprovalAction | null>(null);
  const [busy, setBusy] = useState(false);

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
        body: JSON.stringify({ get_data: "" }),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

      const asObj = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;

      if (!res.ok || (asObj && asObj["ok"] === false)) {
        const msg =
          (asObj && (asObj["message"] || asObj["error"])) ||
          `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`;
        setRows([]);
        setError(String(msg));
        return;
      }
      setRows(normaliseRows(parsed));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach SAP";
      setRows([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** SAP decides what appears here — no client-side filtering by user. */
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      val(r, "REFFLD").toLowerCase().includes(s) ||
      val(r, "SUBJECT").toLowerCase().includes(s) ||
      nfaType(r).toLowerCase().includes(s) ||
      val(r, "NAME1").toLowerCase().includes(s),
    );
  }, [q, rows]);

  /** Status / level columns only render when SAP actually returns those keys. */
  const hasStatus = useMemo(() => rows.some((r) => val(r, "STATUS_TXT")), [rows]);
  const hasLevels = useMemo(
    () => rows.some((r) => LEVELS.some((l) => val(r, `APPR${l}`) || val(r, `STAT${l}`))),
    [rows],
  );

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(filtered.length, 10, 10);
  const visible = filtered.slice(0, visibleCount);

  const selectedRow = selected !== null ? filtered[selected] ?? null : null;
  const selectedEnfaNo = selectedRow ? val(selectedRow, "REFFLD") : "";

  function requireSelection() {
    if (!selectedRow || !selectedEnfaNo) {
      toast.info("Select a record first.");
      return false;
    }
    return true;
  }

  async function submitAction(action: ApprovalAction, comment: string) {
    if (!selectedEnfaNo) {
      toast.info("Select a record first.");
      return;
    }
    setBusy(true);
    try {
      if (action === "approve" || action === "reject") {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? "";
        const res = await fetch("/api/public/enfa-approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action, reffld: selectedEnfaNo, comment }),
        });
        const text = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try { parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null; } catch { parsed = null; }

        const message = String(parsed?.["message"] ?? parsed?.["error"] ?? "").trim();
        if (!res.ok || parsed?.["ok"] === false) {
          toast.error(message || `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`);
          return;
        }
        toast.success(message || (action === "approve" ? "SAP accepted the approval" : "SAP accepted the rejection"));
      } else {
        // Back To Initiator / Clarification are wired once their
        // SAP payloads are registered in Admin → SAP API Settings.
        toast.info("This action is not yet connected to SAP.");
        return;
      }

      setCommentAction(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
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
        title="Approvals Inbox"
        subtitle="Items currently waiting for your decision."
        actions={
          <>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ENFA #, subject…" className="h-9 w-full pl-9 sm:w-64" />
            </div>
          </>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {selectedEnfaNo ? <span className="ml-2 font-mono text-xs text-accent">{selectedEnfaNo}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setDocsOpen(true)}>
              <Paperclip className="h-3.5 w-3.5" /> Attached Docs
            </Button>
            <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/90" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("approve")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("reject")}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 border-accent" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("back_to_initiator")}>
              <RotateCcw className="h-3.5 w-3.5" /> Back To Initiator
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 border-primary" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("clarification")}>
              <HelpCircle className="h-3.5 w-3.5" /> Clarification
            </Button>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="space-y-2.5 md:hidden">
          {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
              <div className="text-sm font-medium">{error ? "Worklist unavailable" : "No items"}</div>
              <div className="mx-auto max-w-sm text-xs text-muted-foreground">{emptyText}</div>
              {error && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => void load()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
          )}
          {visible.map((r, i) => {
            const status = val(r, "STATUS_TXT");
            const cur = currentLevel(r);
            const tot = totalLevels(r);
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
                      name="approval-record"
                      className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                      checked={selected === i}
                      onChange={() => setSelected(i)}
                      aria-label={`Select ${val(r, "REFFLD")}`}
                    />
                    <span className="font-mono text-[11px] font-semibold text-accent">{val(r, "REFFLD") || "—"}</span>
                  </span>
                  {hasStatus && (
                    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + statusTone(status)}>{status || "—"}</span>
                  )}
                </div>
                <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{val(r, "SUBJECT") || "—"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {nfaType(r)} · {val(r, "PSPNR") || "—"} · {val(r, "BEGDA") || "—"}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{val(r, "NAME1") || "—"}</span>
                  {hasLevels && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Level {cur} / {tot}
                    </span>
                  )}
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
                  <Th>ENFA No</Th>
                  <Th>Plant</Th>
                  <Th>Plant Name</Th>
                  <Th>NFA Type</Th>
                  <Th>Date</Th>
                  <Th>Subject</Th>
                  {hasStatus && <Th>Status</Th>}
                  {hasLevels && <Th>Level</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={20}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={20} className="px-4 py-12 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <div className="text-sm font-medium">{error ? "Worklist unavailable" : "No items"}</div>
                    <div className="text-xs text-muted-foreground">{emptyText}</div>
                    {error && (
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => void load()}>
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                  </td></tr>
                )}
                {filtered.map((r, i) => {
                  const status = val(r, "STATUS_TXT");
                  const cur = currentLevel(r);
                  const tot = totalLevels(r);
                  return (
                    <tr
                      key={`${val(r, "REFFLD")}-${i}`}
                      onClick={() => setSelected(i)}
                      className={"cursor-pointer hover:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
                    >
                      <Td>
                        <input
                          type="radio"
                          name="approval-record-desktop"
                          className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                          checked={selected === i}
                          onChange={() => setSelected(i)}
                          aria-label={`Select ${val(r, "REFFLD")}`}
                        />
                      </Td>
                      <Td><span className="font-mono text-xs font-medium text-accent">{val(r, "REFFLD") || "—"}</span></Td>
                      <Td>{val(r, "PSPNR") || "—"}</Td>
                      <Td className="text-muted-foreground">{val(r, "NAME1") || "—"}</Td>
                      <Td>{nfaType(r)}</Td>
                      <Td className="text-muted-foreground">{val(r, "BEGDA") || "—"}</Td>
                      <Td className="max-w-[280px] truncate">{val(r, "SUBJECT") || "—"}</Td>
                      {hasStatus && (
                        <Td><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + statusTone(status)}>{status || "—"}</span></Td>
                      )}
                      {hasLevels && (
                        <Td>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            Level {cur} / {tot}
                          </span>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecordAttachmentsDialog
        enfaNumber={selectedEnfaNo || null}
        open={docsOpen}
        onOpenChange={setDocsOpen}
        endpoint="my"
      />
      <RecordPreviewDialog row={selectedRow} open={previewOpen} onOpenChange={setPreviewOpen} endpoint="select" />
      <ApprovalCommentDialog
        open={!!commentAction}
        onOpenChange={(o) => { if (!o) setCommentAction(null); }}
        enfaNumber={selectedEnfaNo || "—"}
        action={commentAction}
        onSubmit={submitAction}
        busy={busy}
      />
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 whitespace-nowrap font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 whitespace-nowrap " + className}>{children}</td>;
}
