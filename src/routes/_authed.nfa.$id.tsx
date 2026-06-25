import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, STATUS_TONE, type ApproverRow, type NfaRow } from "@/lib/nfa-types";
import { nfaTypeName, plantName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, ArrowLeft, FileEdit, Check, X, Undo2, HelpCircle, Clock, User, Filter, Loader2, Inbox, SearchX, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentList, type Attachment } from "@/components/AttachmentList";
import { APPROVER_STATUS_LABEL, APPROVER_TONE } from "@/lib/nfa-types";

export const Route = createFileRoute("/_authed/nfa/$id")({
  component: NfaDetail,
});

interface AuditRow {
  id: string;
  action: string;
  comment: string | null;
  actor_id: string | null;
  at: string;
  level: number | null;
  old_status: string | null;
  new_status: string | null;
  approver_name: string | null;
  action_kind: string | null;
}

function NfaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [nfa, setNfa] = useState<NfaRow | null>(null);
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);
  const [attachmentsKey, setAttachmentsKey] = useState(0);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [fAction, setFAction] = useState<string>("all");
  const [fType, setFType] = useState<string>("all");
  const [fApprover, setFApprover] = useState<string>("");
  const [fLevel, setFLevel] = useState<string>("all");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");
  const [sortKey, setSortKey] = useState<"at" | "action" | "actor">("at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const load = useCallback(async () => {
    const { data: n } = await supabase.from("nfa").select("*").eq("id", id).maybeSingle();
    setNfa((n as NfaRow) ?? null);
    const { data: a } = await supabase.from("nfa_approver").select("*").eq("nfa_id", id).order("level");
    setApprovers((a as ApproverRow[]) ?? []);
    const { data: au } = await supabase.from("nfa_audit").select("*").eq("nfa_id", id).order("at", { ascending: false });
    setAudit((au as AuditRow[]) ?? []);
    setAuditLoading(false);
    const ids = [n?.initiator_id, ...((a ?? []).map((r) => r.approver_id)), ...((au ?? []).map((r) => r.actor_id))].filter((x): x is string => Boolean(x));
    setProfiles(await fetchProfilesMap(ids));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Classify each audit row into a broad event type for the Type filter.
  // Approver actions populate action_kind; other events are derived from action text.
  const classifyEvent = (a: AuditRow): "creation" | "change" | "approval" | "attachment" | "resubmit" | "other" => {
    if (a.action_kind && ["approve", "reject", "back", "clarify"].includes(a.action_kind)) return "approval";
    const t = (a.action || "").toLowerCase();
    if (t.startsWith("created") || t.startsWith("submitted for approval")) return "creation";
    if (t.startsWith("change request")) return "change";
    if (t.startsWith("uploaded attachment")) return "attachment";
    if (t.startsWith("re-submitted")) return "resubmit";
    return "other";
  };

  const filteredAudit = useMemo(() => {
    const q = fApprover.trim().toLowerCase();
    const fromMs = fFrom ? new Date(fFrom + "T00:00:00").getTime() : null;
    const toMs = fTo ? new Date(fTo + "T23:59:59").getTime() : null;
    // If the range is invalid (From after To), ignore the date filter
    // entirely so the table behaves predictably while the user fixes it.
    const rangeInvalid = fromMs !== null && toMs !== null && fromMs > toMs;
    return audit.filter((a) => {
      if (fType !== "all" && classifyEvent(a) !== fType) return false;
      if (fAction !== "all" && a.action_kind !== fAction) return false;
      if (fLevel !== "all" && String(a.level ?? "") !== fLevel) return false;
      if (q) {
        const name = (a.approver_name || nameFor(profiles, a.actor_id ?? undefined) || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (!rangeInvalid) {
        const t = new Date(a.at).getTime();
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
      }
      return true;
    }).slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === "at") {
        cmp = new Date(a.at).getTime() - new Date(b.at).getTime();
      } else if (sortKey === "action") {
        cmp = (a.action || "").localeCompare(b.action || "");
      } else {
        const an = a.approver_name || nameFor(profiles, a.actor_id ?? undefined) || "";
        const bn = b.approver_name || nameFor(profiles, b.actor_id ?? undefined) || "";
        cmp = an.localeCompare(bn);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [audit, fType, fAction, fApprover, fLevel, fFrom, fTo, sortKey, sortDir, profiles]);

  const dateRangeError = useMemo(() => {
    if (!fFrom || !fTo) return null;
    const f = new Date(fFrom + "T00:00:00").getTime();
    const t = new Date(fTo + "T23:59:59").getTime();
    if (Number.isNaN(f) || Number.isNaN(t)) return "Enter valid From and To dates.";
    if (f > t) return "From date must be on or before To date.";
    return null;
  }, [fFrom, fTo]);

  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / pageSize));
  useEffect(() => { setPage(1); }, [fType, fAction, fApprover, fLevel, fFrom, fTo, sortKey, sortDir, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageStart = (page - 1) * pageSize;
  const pagedAudit = filteredAudit.slice(pageStart, pageStart + pageSize);

  if (!nfa) return <div className="p-4 text-slate-500">Loading…</div>;

  const isInitiator = user?.id === nfa.initiator_id;
  const myApprover = approvers.find((a) => a.approver_id === user?.id && a.level === nfa.current_level && a.status === "pending" && nfa.status === "in_process");

  async function uploadFiles(list: FileList | null) {
    if (!list || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const path = `${nfa!.id}/${Date.now()}-${file.name}`;
        const { error: ue } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
        if (ue) throw ue;
        const { error: ie } = await supabase.from("nfa_attachment").insert({
          nfa_id: nfa!.id, storage_path: path, filename: file.name,
          mime: file.type || null, size: file.size, uploaded_by: user.id,
        });
        if (ie) throw ie;
      }
      await supabase.from("nfa_audit").insert({ nfa_id: nfa!.id, actor_id: user.id, action: "Uploaded attachment(s)" });
      toast.success("Uploaded");
      load();
      setAttachmentsKey((k) => k + 1);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function act(kind: "approve" | "reject" | "back" | "clarify") {
    if (!myApprover || !user) return;
    if ((kind === "reject" || kind === "back" || kind === "clarify") && !comment.trim()) {
      return toast.error("A comment is required for Reject / Back / Clarification");
    }
    setBusy(true);
    const { error } = await supabase.rpc("nfa_act", {
      _nfa_id: nfa!.id, _action: kind, _comment: comment || undefined,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    setComment("");
    await load();
    setBusy(false);
    toast.success("Action recorded");
  }

  async function resubmit() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.rpc("nfa_resubmit", { _nfa_id: nfa!.id, _comment: comment || undefined });
    if (error) { setBusy(false); return toast.error(error.message); }
    setComment("");
    await load();
    setBusy(false);
    toast.success("Resubmitted");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/nfa/my" })}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
        <div className="flex items-center gap-2 text-sm">
          {isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected") && (
            <Link to="/nfa/$id/change" params={{ id: nfa.id }}>
              <Button size="sm" variant="outline" className="gap-1.5"><FileEdit className="h-4 w-4" /> Request Change</Button>
            </Link>
          )}
          <span className="text-slate-600">ENFA</span>
          <span className="font-bold text-slate-800">{nfa.enfa_number}</span>
          <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + STATUS_TONE[nfa.status]}>
            {STATUS_LABEL[nfa.status]}
          </span>
        </div>
      </div>

      <Card className="border-slate-300">
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center text-base font-bold italic text-slate-800">NOTE FOR APPROVAL</div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 text-sm">
          <ReadField label="Company" value={nfa.company} />
          <ReadField label="Plant" value={`${nfa.plant ?? ""} ${plantName(nfa.plant) ? "– " + plantName(nfa.plant) : ""}`} />
          <ReadField label="NFA Type" value={nfaTypeName(nfa.nfa_type)} />
          <ReadField label="Function" value={nfa.function ?? ""} />
          <ReadField label="Subject" value={nfa.subject} className="md:col-span-2" />
          <ReadField label="Scope Impact" value={nfa.scope_impact ?? ""} className="md:col-span-2" />
          <ReadField label="Budget (Lakhs)" value={nfa.budget_impact?.toString() ?? ""} />
          <ReadField label="Timeline (Days)" value={nfa.timeline_days?.toString() ?? ""} />
          <ReadField label="Initiator" value={nameFor(profiles, nfa.initiator_id)} />
          <ReadField label="Created" value={new Date(nfa.created_at).toLocaleString()} />
          {nfa.detailed_description && (
            <div className="md:col-span-2"><Label className="text-xs text-slate-500">Detailed Description</Label>
              <div className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3">{nfa.detailed_description}</div>
            </div>
          )}
        </div>
      </Card>

      <AttachmentList
        nfaId={nfa.id}
        refreshKey={attachmentsKey}
        title={myApprover ? "Documents Attached by Initiator — please review before action" : "Supporting Documents"}
        emptyText={myApprover ? "No documents were attached to this NFA." : "No attachments uploaded yet."}
      />
      {isInitiator && (
        <div className="flex items-center justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> Upload Attachment
            <input type="file" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.currentTarget.value = ""; }} disabled={busy} />
          </label>
        </div>
      )}

      <Card className="border-slate-300 p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Approval Chain</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-700">
            <tr><th className="p-2">Level</th><th className="p-2">Approver</th><th className="p-2">Designation</th><th className="p-2">Status</th><th className="p-2">Acted</th><th className="p-2">Comment</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {approvers.map((a) => (
              <tr key={a.id} className={a.level === nfa.current_level && nfa.status === "in_process" ? "bg-sky-50" : ""}>
                <td className="p-2">{a.level}</td>
                <td className="p-2">{nameFor(profiles, a.approver_id)}</td>
                <td className="p-2">{a.designation ?? ""}</td>
                <td className="p-2">
                  <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + APPROVER_TONE[a.status]}>
                    {APPROVER_STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="p-2">{a.acted_at ? new Date(a.acted_at).toLocaleString() : ""}</td>
                <td className="p-2 text-slate-600">{a.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="border-slate-300 p-5">
        <h3 className="mb-4 font-display text-base font-bold text-slate-800">Approvals Timeline</h3>
        <ol className="relative ml-3 border-l-2 border-slate-200">
          {approvers.map((a) => {
            const isCurrent = a.level === nfa.current_level && nfa.status === "in_process";
            const dot = stepDot(a.status, isCurrent);
            return (
              <li key={a.id} className="relative mb-6 pl-6 last:mb-0">
                <span className={`absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-background ${dot.bg}`}>
                  <dot.Icon className={`h-3.5 w-3.5 ${dot.fg}`} />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level {a.level}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${APPROVER_TONE[a.status]}`}>
                    {APPROVER_STATUS_LABEL[a.status]}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
                      Awaiting action
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {nameFor(profiles, a.approver_id)}
                  </span>
                  {a.designation && <span className="text-xs text-slate-500">{a.designation}</span>}
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {a.acted_at ? new Date(a.acted_at).toLocaleString() : "—"}
                  </span>
                </div>
                {a.comment && (
                  <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm italic text-slate-700">
                    “{a.comment}”
                  </p>
                )}
                {isCurrent && myApprover && myApprover.id === a.id && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => act("approve")} disabled={busy} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => act("reject")}
                        disabled={busy || !comment.trim()}
                        variant="destructive"
                        className="gap-1"
                        title={!comment.trim() ? "Enter a comment in Your Action below to reject" : undefined}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                    {!comment.trim() && (
                      <p className="text-[11px] text-rose-600">A comment is required to reject — fill the Your Action comment below.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {approvers.length === 0 && (
            <li className="pl-6 text-sm text-slate-500">No approvers configured.</li>
          )}
        </ol>
      </Card>

      {myApprover && (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-semibold text-slate-800">Your Action (Level {myApprover.level})</h3>
          <Textarea placeholder="Comment (required for Reject / Send Back / Clarification)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act("approve")} disabled={busy} className="bg-green-600 hover:bg-green-700">Approve</Button>
            <Button onClick={() => act("reject")} disabled={busy || !comment.trim()} variant="destructive" title={!comment.trim() ? "Enter a comment to reject" : undefined}>Reject</Button>
            <Button onClick={() => act("back")} disabled={busy || !comment.trim()} variant="outline" title={!comment.trim() ? "Enter a comment to send back" : undefined}>Back To Initiator</Button>
            <Button onClick={() => act("clarify")} disabled={busy || !comment.trim()} variant="outline" title={!comment.trim() ? "Enter a comment to request clarification" : undefined}>Request Clarification</Button>
          </div>
          {!comment.trim() && (
            <p className="mt-2 text-xs text-rose-600">A comment is required for Reject, Back, and Clarification.</p>
          )}
        </Card>
      )}

      {isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected") && approvers.length > 0 && (
        <Card className="border-sky-300 bg-sky-50 p-4">
          <h3 className="mb-2 font-semibold text-slate-800">Initiator Action</h3>
          <Textarea placeholder="Add a note for approvers (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3"><Button onClick={resubmit} disabled={busy} className="bg-yellow-300 text-slate-900 hover:bg-yellow-400">Resubmit for Approval</Button></div>
        </Card>
      )}

      <Card className="border-slate-300 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Audit Log</h3>
          {(fType !== "all" || fAction !== "all" || fApprover || fLevel !== "all" || fFrom || fTo || sortKey !== "at" || sortDir !== "desc") && (
            <Button size="sm" variant="ghost" onClick={() => { setFType("all"); setFAction("all"); setFApprover(""); setFLevel("all"); setFFrom(""); setFTo(""); setSortKey("at"); setSortDir("desc"); }}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-6">
          <div>
            <Label className="text-[11px] uppercase text-slate-500"><Filter className="mr-1 inline h-3 w-3" />Type</Label>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="creation">Creation</SelectItem>
                <SelectItem value="change">Change Request</SelectItem>
                <SelectItem value="approval">Approval Action</SelectItem>
                <SelectItem value="resubmit">Re-submission</SelectItem>
                <SelectItem value="attachment">Attachment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500"><Filter className="mr-1 inline h-3 w-3" />Action</Label>
            <Select value={fAction} onValueChange={setFAction}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="clarify">Clarification</SelectItem>
                <SelectItem value="back">Back to Initiator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500">Approver / Actor</Label>
            <Input className="h-8" placeholder="Name…" value={fApprover} onChange={(e) => setFApprover(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500">Level</Label>
            <Select value={fLevel} onValueChange={setFLevel}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {Array.from(new Set(approvers.map((a) => a.level))).sort((a, b) => a - b).map((lv) => (
                  <SelectItem key={lv} value={String(lv)}>Level {lv}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500">From</Label>
            <Input
              type="date"
              className={`h-8 ${dateRangeError ? "border-rose-400 focus-visible:ring-rose-300" : ""}`}
              value={fFrom}
              max={fTo || undefined}
              aria-invalid={!!dateRangeError}
              onChange={(e) => setFFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500">To</Label>
            <Input
              type="date"
              className={`h-8 ${dateRangeError ? "border-rose-400 focus-visible:ring-rose-300" : ""}`}
              value={fTo}
              min={fFrom || undefined}
              aria-invalid={!!dateRangeError}
              onChange={(e) => setFTo(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] uppercase text-slate-500">Quick range</Label>
            <div className="flex flex-wrap gap-1">
              {(() => {
                const fmt = (d: Date) => {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                };
                const apply = (days: number) => {
                  const to = new Date();
                  const from = new Date();
                  if (days > 1) from.setDate(from.getDate() - (days - 1));
                  setFFrom(fmt(from));
                  setFTo(fmt(to));
                };
                const today = new Date();
                const todayStr = fmt(today);
                const last7From = new Date(); last7From.setDate(last7From.getDate() - 6);
                const last30From = new Date(); last30From.setDate(last30From.getDate() - 29);
                const isToday = fFrom === todayStr && fTo === todayStr;
                const isLast7 = fFrom === fmt(last7From) && fTo === todayStr;
                const isLast30 = fFrom === fmt(last30From) && fTo === todayStr;
                const btn = (label: string, active: boolean, onClick: () => void) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                      active
                        ? "border-slate-800 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
                return (
                  <>
                    {btn("Today", isToday, () => apply(1))}
                    {btn("Last 7 days", isLast7, () => apply(7))}
                    {btn("Last 30 days", isLast30, () => apply(30))}
                  </>
                );
              })()}
            </div>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-slate-500">Sort</Label>
            <div className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-800">
                {sortKey === "at" ? "Timestamp" : sortKey === "action" ? "Action" : "Approver"}
              </span>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="font-medium text-slate-700 underline-offset-2 hover:underline"
              >
                {sortDir === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Click column headers to sort.</p>
          </div>
        </div>
        {dateRangeError && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            <span>{dateRangeError} The date range is ignored until this is fixed.</span>
            <button
              type="button"
              onClick={() => { setFFrom(""); setFTo(""); }}
              className="font-medium underline-offset-2 hover:underline"
            >
              Clear dates
            </button>
          </div>
        )}
        {(() => {
          const ACTION_LABEL: Record<string, string> = { approve: "Approve", reject: "Reject", clarify: "Clarification", back: "Back to Initiator" };
          const TYPE_LABEL: Record<string, string> = { creation: "Creation", change: "Change Request", approval: "Approval Action", resubmit: "Re-submission", attachment: "Attachment", other: "Other" };
          const chips: { key: string; label: string; onClear: () => void }[] = [];
          if (fType !== "all") chips.push({ key: "type", label: `Type: ${TYPE_LABEL[fType] ?? fType}`, onClear: () => setFType("all") });
          if (fAction !== "all") chips.push({ key: "action", label: `Action: ${ACTION_LABEL[fAction] ?? fAction}`, onClear: () => setFAction("all") });
          if (fApprover) chips.push({ key: "approver", label: `Approver: ${fApprover}`, onClear: () => setFApprover("") });
          if (fLevel !== "all") chips.push({ key: "level", label: `Level ${fLevel}`, onClear: () => setFLevel("all") });
          if (fFrom) chips.push({ key: "from", label: `From: ${fFrom}`, onClear: () => setFFrom("") });
          if (fTo) chips.push({ key: "to", label: `To: ${fTo}`, onClear: () => setFTo("") });
          if (sortKey !== "at" || sortDir !== "desc") {
            const colLabel = sortKey === "at" ? "Timestamp" : sortKey === "action" ? "Action" : "Approver";
            const dirLabel = sortDir === "asc" ? "Ascending" : "Descending";
            chips.push({ key: "sort", label: `Sort: ${colLabel} (${dirLabel})`, onClear: () => { setSortKey("at"); setSortDir("desc"); } });
          }
          if (chips.length === 0) return null;
          return (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Active filters</span>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                {filteredAudit.length} {filteredAudit.length === 1 ? "match" : "matches"}
              </span>
              {chips.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700 shadow-sm">
                  {c.label}
                  <button
                    type="button"
                    aria-label={`Remove ${c.label}`}
                    onClick={c.onClear}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => { setFType("all"); setFAction("all"); setFApprover(""); setFLevel("all"); setFFrom(""); setFTo(""); setSortKey("at"); setSortDir("desc"); }}
                className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
              >
                Clear all
              </button>
            </div>
          );
        })()}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-700">
              <tr>
                {(() => {
                  const SortableTh = ({ k, label }: { k: "at" | "action" | "actor"; label: string }) => {
                    const active = sortKey === k;
                    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            else { setSortKey(k); setSortDir(k === "at" ? "desc" : "asc"); }
                          }}
                          className={`inline-flex items-center gap-1 uppercase ${active ? "text-slate-900" : "text-slate-700 hover:text-slate-900"}`}
                          aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                        >
                          {label}
                          <Icon className={`h-3 w-3 ${active ? "text-slate-700" : "text-slate-400"}`} />
                        </button>
                      </th>
                    );
                  };
                  return (
                    <>
                      <SortableTh k="at" label="Timestamp" />
                      <SortableTh k="action" label="Action" />
                      <th className="p-2">Level</th>
                      <SortableTh k="actor" label="Approver / Actor" />
                      <th className="p-2">Status Change</th>
                      <th className="p-2">Comment</th>
                    </>
                  );
                })()}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedAudit.map((a) => {
                const actor = a.approver_name || nameFor(profiles, a.actor_id ?? undefined);
                const hasChange = a.old_status && a.new_status && a.old_status !== a.new_status;
                return (
                  <tr key={a.id} className="align-top">
                    <td className="p-2 text-slate-500 whitespace-nowrap">{new Date(a.at).toLocaleString()}</td>
                    <td className="p-2 font-medium text-slate-800">{a.action}</td>
                    <td className="p-2 text-slate-600">{a.level ?? ""}</td>
                    <td className="p-2 text-slate-700">{actor}</td>
                    <td className="p-2 text-xs">
                      {hasChange ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + (STATUS_TONE[a.old_status as keyof typeof STATUS_TONE] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200")}>
                            {STATUS_LABEL[a.old_status as keyof typeof STATUS_LABEL] ?? a.old_status}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + (STATUS_TONE[a.new_status as keyof typeof STATUS_TONE] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200")}>
                            {STATUS_LABEL[a.new_status as keyof typeof STATUS_LABEL] ?? a.new_status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2 italic text-slate-600">{a.comment ?? ""}</td>
                  </tr>
                );
              })}
              {auditLoading && (
                <tr>
                  <td colSpan={6} className="p-6">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading audit log…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!auditLoading && pagedAudit.length === 0 && audit.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500">
                      <Inbox className="h-8 w-8 text-slate-300" />
                      <div className="text-sm font-medium text-slate-700">No audit entries yet</div>
                      <div className="text-xs">Approval and action history will appear here once activity begins on this NFA.</div>
                    </div>
                  </td>
                </tr>
              )}
              {!auditLoading && pagedAudit.length === 0 && audit.length > 0 && (
                <tr>
                  <td colSpan={6} className="p-8">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500">
                      <SearchX className="h-8 w-8 text-slate-300" />
                      <div className="text-sm font-medium text-slate-700">No entries match your filters</div>
                      <div className="text-xs">0 of {audit.length} entries match the current filters. Try adjusting the action, approver, level, or date range.</div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => { setFType("all"); setFAction("all"); setFApprover(""); setFLevel("all"); setFFrom(""); setFTo(""); setSortKey("at"); setSortDir("desc"); }}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredAudit.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-medium text-slate-800">{pageStart + 1}–{Math.min(pageStart + pageSize, filteredAudit.length)}</span> of <span className="font-medium text-slate-800">{filteredAudit.length}</span> matching {filteredAudit.length === 1 ? "entry" : "entries"}
              {filteredAudit.length !== audit.length && (
                <span className="text-slate-400"> (of {audit.length} total)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] uppercase text-slate-500">Rows</Label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-7 w-[72px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span>Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReadField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="mt-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-800">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  );
}

function stepDot(status: ApproverRow["status"], isCurrent: boolean) {
  if (status === "approved") return { Icon: Check, bg: "bg-emerald-500", fg: "text-white" };
  if (status === "rejected") return { Icon: X, bg: "bg-rose-500", fg: "text-white" };
  if (status === "sent_back") return { Icon: Undo2, bg: "bg-amber-500", fg: "text-white" };
  if (status === "clarification") return { Icon: HelpCircle, bg: "bg-amber-500", fg: "text-white" };
  if (isCurrent) return { Icon: Clock, bg: "bg-blue-500", fg: "text-white" };
  return { Icon: Clock, bg: "bg-slate-200", fg: "text-slate-500" };
}