import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, STATUS_TONE, APPROVER_TONE, type NfaRow, type ApproverRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { PlusCircle, Search, FileText, Upload, Paperclip, Eye, Pencil } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { toast } from "sonner";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { RecordAttachmentsDialog, uploadToSap } from "@/components/report/RecordAttachmentsDialog";
import { RecordEditDialog } from "@/components/report/RecordEditDialog";
import { RecordPreviewDialog } from "@/components/report/RecordPreviewDialog";
import { useRef } from "react";

export const Route = createFileRoute("/_authed/nfa/my")({
  component: MyNfas,
});

const EMPTY_LEVELS = {
  ROLE1: "", APPR1: "", STAT1: "",
  ROLE2: "", APPR2: "", STAT2: "",
  ROLE3: "", APPR3: "", STAT3: "",
  ROLE4: "", APPR4: "", STAT4: "",
  ROLE5: "", APPR5: "", STAT5: "",
  ROLE6: "", APPR6: "", STAT6: "",
};

/** Maps a local NFA row onto the SAP report row shape the shared dialogs expect. */
function toSapRow(
  r: NfaRow,
  chain: ApproverRow[],
  profiles: Record<string, { full_name: string | null; email: string | null }>,
): SapReportRow {
  const levels: Record<string, string> = { ...EMPTY_LEVELS };
  for (const a of chain) {
    if (a.level < 1 || a.level > 6) continue;
    levels[`ROLE${a.level}`] = a.designation ?? "";
    levels[`APPR${a.level}`] = nameFor(profiles, a.approver_id);
    levels[`STAT${a.level}`] = a.status ?? "";
  }
  return {
    REFFLD: r.enfa_number ?? "",
    PSPNR: r.plant ?? "",
    NAME1: r.plant_name ?? "",
    FUNCT_TXT: nfaTypeName(r.nfa_type),
    EXTR_TXT: "",
    SUBJECT: r.subject ?? "",
    INIT_NAME: "",
    BEGDA: new Date(r.created_at).toLocaleDateString(),
    STATUS_TXT: STATUS_LABEL[r.status] ?? "",
    ...(levels as unknown as Omit<SapReportRow, "REFFLD" | "PSPNR" | "NAME1" | "FUNCT_TXT" | "EXTR_TXT" | "SUBJECT" | "INIT_NAME" | "BEGDA" | "STATUS_TXT">),
  };
}

function MyNfas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NfaRow[]>([]);
  const [appr, setAppr] = useState<Record<string, ApproverRow[]>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: nfas } = await supabase.from("nfa").select("*").eq("initiator_id", user.id).order("created_at", { ascending: false });
      setRows((nfas as NfaRow[]) ?? []);
      const ids = (nfas ?? []).map((n) => n.id);
      if (ids.length) {
        const { data: as } = await supabase.from("nfa_approver").select("*").in("nfa_id", ids).order("level");
        const m: Record<string, ApproverRow[]> = {};
        for (const r of (as as ApproverRow[]) ?? []) (m[r.nfa_id] ||= []).push(r);
        setAppr(m);
        setProfiles(await fetchProfilesMap(((as as ApproverRow[]) ?? []).map((a) => a.approver_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => r.enfa_number.toLowerCase().includes(s) || r.subject.toLowerCase().includes(s));
  }, [q, rows]);

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(filtered.length, 10, 10);
  const visible = filtered.slice(0, visibleCount);

  const selectedNfa = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const selectedSapRow = useMemo(
    () => (selectedNfa ? toSapRow(selectedNfa, appr[selectedNfa.id] ?? [], profiles) : null),
    [selectedNfa, appr, profiles],
  );
  const selectedEnfaNo = selectedSapRow?.REFFLD?.trim() || "";

  function requireSelection() {
    if (!selectedNfa) {
      toast.info("Select a record first.");
      return false;
    }
    if (!selectedEnfaNo) {
      toast.info("This NFA does not have an eNFA number in SAP yet.");
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
            <div className="text-xs text-muted-foreground">{q ? "Try a different search." : "Create your first NFA to get started."}</div>
          </div>
        )}
        {visible.map((r) => {
          const chain = appr[r.id] ?? [];
          const current = chain.find((c) => c.level === r.current_level);
          return (
            <Link key={r.id} to="/nfa/$id" params={{ id: r.id }} className="block rounded-lg border border-border bg-card p-3 shadow-sm active:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-accent">{r.enfa_number}</span>
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{r.subject}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {nfaTypeName(r.nfa_type)} · {r.plant ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
              </div>
              {current && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
                  <span className="text-muted-foreground">L{current.level} · <span className="text-foreground">{nameFor(profiles, current.approver_id)}</span></span>
                  <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + APPROVER_TONE[current.status]}>{current.status}</span>
                </div>
              )}
            </Link>
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
                <Th>ENFA Number</Th><Th>Status</Th><Th>Plant</Th><Th>NFA Type</Th><Th>Subject</Th><Th>Created</Th>
                {[1,2,3,4,5,6].map((l) => (<Th key={`s${l}`}>{`L${l}`}</Th>))}
                <Th> </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={20}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={20} className="px-4 py-12 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <div className="text-sm font-medium">No NFAs found</div>
                  <div className="text-xs text-muted-foreground">{q ? "Try a different search." : "Create your first NFA to get started."}</div>
                </td></tr>
              )}
              {filtered.map((r) => {
                const chain = appr[r.id] ?? [];
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <Td><Link to="/nfa/$id" params={{ id: r.id }} className="font-mono text-xs font-medium text-accent hover:underline">{r.enfa_number}</Link></Td>
                    <Td><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span></Td>
                    <Td className="text-muted-foreground">{r.plant ? `${r.plant} · ${r.plant_name ?? ""}` : "—"}</Td>
                    <Td>{nfaTypeName(r.nfa_type)}</Td>
                    <Td className="max-w-[280px] truncate">{r.subject}</Td>
                    <Td className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</Td>
                    {[1,2,3,4,5,6].map((l) => {
                      const a = chain.find((c) => c.level === l);
                      return (
                        <Td key={`s${l}`}>
                          {a ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate text-xs">{nameFor(profiles, a.approver_id)}</span>
                              <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + APPROVER_TONE[a.status]}>{a.status}</span>
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </Td>
                      );
                    })}
                    <Td><Link to="/nfa/$id" params={{ id: r.id }}><Button variant="outline" size="sm">Open</Button></Link></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 whitespace-nowrap font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 whitespace-nowrap " + className}>{children}</td>;
}