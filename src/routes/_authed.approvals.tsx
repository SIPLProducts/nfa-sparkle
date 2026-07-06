import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type ApproverRow, type NfaRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Inbox, CheckCircle2, Check, X, Paperclip, Trash2, HelpCircle } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/approvals")({
  component: ApprovalsInbox,
});

function ApprovalsInbox() {
  const { user } = useAuth();
  const [rows, setRows] = useState<{ nfa: NfaRow; ap: ApproverRow }[]>([]);
  const [levelMap, setLevelMap] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<null | { kind: "approve" | "reject" | "clarify"; nfa: NfaRow; ap: ApproverRow }>(null);
  const [remark, setRemark] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: aps } = await supabase.from("nfa_approver").select("*").eq("approver_id", user.id);
    const list = (aps as ApproverRow[]) ?? [];
    if (!list.length) { setRows([]); setLoading(false); return; }
    const nfaIds = list.map((l) => l.nfa_id);
    const { data: nfas } = await supabase.from("nfa").select("*").in("id", nfaIds);
    const nMap = new Map(((nfas as NfaRow[]) ?? []).map((n) => [n.id, n]));
    const { data: allAps } = await supabase.from("nfa_approver").select("nfa_id,level").in("nfa_id", nfaIds);
    const lm: Record<string, number> = {};
    for (const r of (allAps as { nfa_id: string; level: number }[]) ?? []) {
      lm[r.nfa_id] = Math.max(lm[r.nfa_id] ?? 0, r.level);
    }
    setLevelMap(lm);
    const joined = list
      .map((ap) => ({ ap, nfa: nMap.get(ap.nfa_id)! }))
      .filter((r) => r.nfa && r.nfa.status === "in_process" && r.nfa.current_level === r.ap.level && r.ap.status === "pending");
    setRows(joined);
    setProfiles(await fetchProfilesMap(joined.map((r) => r.nfa.initiator_id)));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  function openAction(kind: "approve" | "reject" | "clarify", nfa: NfaRow, ap: ApproverRow) {
    setAction({ kind, nfa, ap });
    setRemark("");
    setFiles([]);
  }

  async function submitAction() {
    if (!action || !user) return;
    if (!remark.trim()) return toast.error("A remark is required");
    setBusy(true);
    try {
      // Upload attachments first (best-effort)
      const uploaded: string[] = [];
      for (const file of files) {
        const path = `${action.nfa.id}/${Date.now()}-${file.name}`;
        const { error: se } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
        if (se) { toast.error(`Upload failed for ${file.name}: ${se.message}`); continue; }
        const { error: ie } = await supabase.from("nfa_attachment").insert({
          nfa_id: action.nfa.id, storage_path: path, filename: file.name,
          mime: file.type || null, size: file.size, uploaded_by: user.id,
        });
        if (ie) { toast.error(`Record failed for ${file.name}: ${ie.message}`); continue; }
        uploaded.push(file.name);
      }
      if (uploaded.length) {
        await supabase.from("nfa_audit").insert({
          nfa_id: action.nfa.id, actor_id: user.id,
          action: `Attached ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`,
          comment: uploaded.join(", "),
        });
      }
      const { error } = await supabase.rpc("nfa_act", {
        _nfa_id: action.nfa.id, _action: action.kind, _comment: remark,
      });
      if (error) throw error;
      toast.success(
        action.kind === "approve" ? "Approved" :
        action.kind === "reject" ? "Rejected" :
        "Clarification requested"
      );
      setAction(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(rows.length, 10, 10);
  const visible = rows.slice(0, visibleCount);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Approvals Inbox"
        subtitle="Items currently waiting for your decision."
        actions={
          <div className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">
            <Inbox className="h-3.5 w-3.5" />
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </div>
        }
      />

      {/* Mobile card list */}
      <div className="space-y-2.5 md:hidden">
        {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/70" />
            <div className="text-sm font-medium">You're all caught up</div>
            <div className="text-xs text-muted-foreground">No items are currently waiting on your decision.</div>
          </div>
        )}
        {visible.map(({ nfa, ap }) => (
          <Link key={ap.id} to="/nfa/$id" params={{ id: nfa.id }} className="block rounded-lg border border-border bg-card p-3 shadow-sm active:bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold text-accent">{nfa.enfa_number}</span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
                Level {ap.level} <span className="mx-1 text-blue-400">/</span> {levelMap[nfa.id] ?? ap.level}
              </span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{nfa.subject}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {nfaTypeName(nfa.nfa_type)} · {nfa.plant ?? "—"}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              <span>From <span className="text-foreground">{nameFor(profiles, nfa.initiator_id)}</span></span>
              <span>{new Date(nfa.created_at).toLocaleDateString()}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5" onClick={(e) => e.preventDefault()}>
              <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); e.preventDefault(); openAction("approve", nfa, ap); }}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={(e) => { e.stopPropagation(); e.preventDefault(); openAction("reject", nfa, ap); }}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="outline" className="col-span-2 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); e.preventDefault(); openAction("clarify", nfa, ap); }}>
                <HelpCircle className="h-3.5 w-3.5" /> Request Clarification
              </Button>
              <Link to="/nfa/$id" params={{ id: nfa.id }} onClick={(e) => e.stopPropagation()} className="col-span-2">
                <Button size="sm" variant="outline" className="w-full">Review</Button>
              </Link>
            </div>
          </Link>
        ))}
        {hasMore && (
          <div ref={setSentinel} className="py-3 text-center text-[11px] text-muted-foreground">
            Loading more… <span className="text-foreground/60">({visibleCount} of {rows.length})</span>
          </div>
        )}
        {!loading && rows.length > 10 && !hasMore && (
          <div className="py-3 text-center text-[11px] text-muted-foreground">All {rows.length} loaded</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">ENFA #</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 font-medium">Plant</th>
                <th className="px-3 py-2.5 font-medium">NFA Type</th>
                <th className="px-3 py-2.5 font-medium">Initiator</th>
                <th className="px-3 py-2.5 font-medium">Submitted</th>
                <th className="px-3 py-2.5 font-medium">Level</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={8} className="px-4 py-6 text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500/70" />
                  <div className="text-sm font-medium">You're all caught up</div>
                  <div className="text-xs text-muted-foreground">No items are currently waiting on your decision.</div>
                </td></tr>
              )}
              {rows.map(({ nfa, ap }) => (
                <tr key={ap.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-accent">
                    <Link to="/nfa/$id" params={{ id: nfa.id }} className="hover:underline">{nfa.enfa_number}</Link>
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2.5">{nfa.subject}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{nfa.plant ? `${nfa.plant} · ${nfa.plant_name ?? ""}` : "—"}</td>
                  <td className="px-3 py-2.5">{nfaTypeName(nfa.nfa_type)}</td>
                  <td className="px-3 py-2.5">{nameFor(profiles, nfa.initiator_id)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(nfa.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
                      Level {ap.level} <span className="mx-1 text-blue-400">/</span> {levelMap[nfa.id] ?? ap.level}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openAction("approve", nfa, ap)}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => openAction("reject", nfa, ap)}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => openAction("clarify", nfa, ap)}>
                        <HelpCircle className="h-3.5 w-3.5" /> Clarify
                      </Button>
                      <Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm" variant="outline">Review</Button></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => !o && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action?.kind === "approve" && (<><Check className="h-4 w-4 text-emerald-600" /> Approve NFA</>)}
              {action?.kind === "reject" && (<><X className="h-4 w-4 text-rose-600" /> Reject NFA</>)}
              {action?.kind === "clarify" && (<><HelpCircle className="h-4 w-4 text-amber-600" /> Request Clarification</>)}
            </DialogTitle>
            {action && (
              <DialogDescription>
                <span className="font-mono text-xs font-semibold text-accent">{action.nfa.enfa_number}</span>
                <span className="ml-2 text-xs">Level {action.ap.level}</span>
                <div className="mt-1 line-clamp-2 text-sm text-foreground">{action.nfa.subject}</div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Remark <span className="text-rose-600">*</span>
              </label>
              <Textarea
                placeholder={
                  action?.kind === "approve" ? "Enter your remark for approval" :
                  action?.kind === "reject" ? "Enter reason for rejection" :
                  "Describe what clarification you need from the initiator"
                }
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="min-h-[96px]"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Attachments (optional)</label>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) setFiles((prev) => [...prev, ...list]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Add files
              </Button>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      <span className="min-w-0 truncate">{f.name} <span className="text-slate-400">({Math.ceil(f.size / 1024)} KB)</span></span>
                      <button type="button" className="ml-2 text-slate-500 hover:text-rose-600" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
            <Button
              onClick={submitAction}
              disabled={busy || !remark.trim()}
              className={
                action?.kind === "approve" ? "gap-1 bg-emerald-600 hover:bg-emerald-700" :
                action?.kind === "clarify" ? "gap-1 bg-amber-500 hover:bg-amber-600 text-white" :
                "gap-1"
              }
              variant={action?.kind === "reject" ? "destructive" : "default"}
            >
              {action?.kind === "approve" && <Check className="h-4 w-4" />}
              {action?.kind === "reject" && <X className="h-4 w-4" />}
              {action?.kind === "clarify" && <HelpCircle className="h-4 w-4" />}
              {busy ? "Submitting…" :
                action?.kind === "approve" ? "Confirm Approve" :
                action?.kind === "reject" ? "Confirm Reject" :
                "Send Clarification Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}