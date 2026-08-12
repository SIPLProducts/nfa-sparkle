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
import { Upload, ArrowLeft, FileEdit, Check, X, Undo2, HelpCircle, Clock, User, Filter, Loader2, Inbox, SearchX, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentList, type Attachment } from "@/components/AttachmentList";
import { APPROVER_STATUS_LABEL, APPROVER_TONE } from "@/lib/nfa-types";
import { Eye, Download as DownloadIcon } from "lucide-react";

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

interface ViewRow {
  id: string;
  attachment_id: string;
  viewer_id: string;
  action: "view" | "download";
  viewed_at: string;
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
  const [views, setViews] = useState<ViewRow[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [tlFilter, setTlFilter] = useState<"all" | "actions" | "documents">("all");
  const [tlSearch, setTlSearch] = useState<string>("");
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
    const { data: vw } = await supabase.from("nfa_attachment_view").select("*").eq("nfa_id", id).order("viewed_at", { ascending: false });
    setViews((vw as ViewRow[]) ?? []);
    const { data: atts } = await supabase.from("nfa_attachment").select("id,filename").eq("nfa_id", id);
    setAttachmentNames(Object.fromEntries(((atts ?? []) as { id: string; filename: string }[]).map((x) => [x.id, x.filename])));
    const ids = [
      n?.initiator_id,
      ...((a ?? []).map((r) => r.approver_id)),
      ...((au ?? []).map((r) => r.actor_id)),
      ...((vw ?? []).map((r) => r.viewer_id)),
    ].filter((x): x is string => Boolean(x));
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
    if (!comment.trim()) {
      return toast.error("A remark is required");
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <button
          onClick={() => nav({ to: "/nfa/my" })}
          className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-tight text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 sm:px-3.5 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
          Back
        </button>

        {isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected") && (
          <Link to="/nfa/$id/change" params={{ id: nfa.id }} className="justify-self-end sm:order-2">
            <Button size="sm" variant="outline" className="gap-1.5"><FileEdit className="h-4 w-4" /> Request Change</Button>
          </Link>
        )}

        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1 sm:order-3 sm:justify-end sm:gap-3">
          <div className="flex min-w-0 items-center divide-x divide-slate-300 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="shrink-0 pr-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">ENFA</span>
            <span className="min-w-0 truncate pl-3 text-sm font-bold tracking-tight text-slate-800 tabular-nums">{nfa.enfa_number}</span>
          </div>

          <span className={"inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-sm " + STATUS_TONE[nfa.status]}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            <span className="truncate">{STATUS_LABEL[nfa.status]}</span>
          </span>
        </div>
      </div>

      <Card className="border-slate-300">
        <div className="relative flex items-center justify-center border-b border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100/60 px-4 py-3 sm:py-4">
          <span className="absolute left-6 hidden h-px w-16 bg-gradient-to-r from-transparent to-slate-300 md:block" />
          <h2 className="text-center font-display text-sm font-bold uppercase tracking-[0.25em] text-slate-800 sm:text-base sm:tracking-[0.3em] md:text-lg md:tracking-[0.35em]">
            Note <span className="text-slate-400">for</span> Approval
          </h2>
          <span className="absolute right-6 hidden h-px w-16 bg-gradient-to-l from-transparent to-slate-300 md:block" />
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:gap-4 sm:p-6 md:grid-cols-2 text-sm">
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
            <RichTextView html={nfa.detailed_description} className="mt-1 rounded border border-slate-200 bg-slate-50 p-3" />
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
      {isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected") && (
        <div className="flex items-center justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> Upload Attachment
            <input type="file" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.currentTarget.value = ""; }} disabled={busy} />
          </label>
        </div>
      )}
      {isInitiator && (nfa.status === "in_process" || nfa.status === "completed") && (
        <p className="text-right text-xs text-slate-500">Attachments are locked while this NFA is {nfa.status === "in_process" ? "under approval" : "completed"}.</p>
      )}

      <Card className="border-slate-300 p-3 sm:p-4">
        <h3 className="mb-3 font-semibold text-slate-700">Approval Chain</h3>
        {/* Mobile: stacked card list */}
        <ul className="space-y-2 md:hidden">
          {approvers.map((a) => {
            const isCurrent = a.level === nfa.current_level && nfa.status === "in_process";
            return (
              <li key={a.id} className={`rounded-md border p-3 text-sm ${isCurrent ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level {a.level}</span>
                  <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + APPROVER_TONE[a.status]}>
                    {APPROVER_STATUS_LABEL[a.status]}
                  </span>
                </div>
                <div className="mt-1 font-medium text-slate-800">{nameFor(profiles, a.approver_id)}</div>
                {a.designation && <div className="text-xs text-slate-500">{a.designation}</div>}
                {a.acted_at && <div className="mt-1 text-xs text-slate-500">{new Date(a.acted_at).toLocaleString()}</div>}
                {a.comment && <p className="mt-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs italic text-slate-600">"{a.comment}"</p>}
              </li>
            );
          })}
        </ul>
        {/* Tablet/Desktop: table with horizontal scroll fallback */}
        <div className="-mx-3 hidden overflow-x-auto md:mx-0 md:block">
          <table className="w-full min-w-[640px] text-sm">
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
                  <td className="p-2 whitespace-nowrap">{a.acted_at ? new Date(a.acted_at).toLocaleString() : ""}</td>
                  <td className="p-2 text-slate-600">{a.comment ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-slate-300 p-3 sm:p-5">
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
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Remark <span className="text-rose-600">*</span>
                      </label>
                      <Textarea
                        placeholder="Enter your remark for approval or rejection"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="min-h-[72px] text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => act("approve")}
                        disabled={busy || !comment.trim()}
                        className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                        title={!comment.trim() ? "A remark is required" : undefined}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => act("reject")}
                        disabled={busy || !comment.trim()}
                        variant="destructive"
                        className="gap-1"
                        title={!comment.trim() ? "A remark is required" : undefined}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                    {!comment.trim() && (
                      <p className="text-[11px] text-rose-600">A remark is required for both Approve and Reject.</p>
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

      <Card className="border-slate-300 p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-display text-base font-bold text-slate-800">Approval Activity Timeline</h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tlSearch}
                onChange={(e) => setTlSearch(e.target.value)}
                placeholder="Search approver, action, file…"
                className="h-7 w-full rounded-md border border-slate-300 bg-white pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-slate-500 sm:w-56"
              />
            </div>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
              {([
                { k: "all", label: "All" },
                { k: "actions", label: "Actions" },
                { k: "documents", label: "Documents" },
              ] as const).map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setTlFilter(opt.k)}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    tlFilter === opt.k ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {audit.length} action{audit.length === 1 ? "" : "s"} · {views.length} document view{views.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {(() => {
          type TLEvent =
            | { kind: "audit"; at: string; row: AuditRow }
            | { kind: "view"; at: string; row: ViewRow };
          const q = tlSearch.trim().toLowerCase();
          const allEvents: TLEvent[] = [
            ...(tlFilter === "documents" ? [] : audit.map((r) => ({ kind: "audit" as const, at: r.at, row: r }))),
            ...(tlFilter === "actions" ? [] : views.map((r) => ({ kind: "view" as const, at: r.viewed_at, row: r }))),
          ];
          const events = (q
            ? allEvents.filter((ev) => {
                if (ev.kind === "audit") {
                  const r = ev.row;
                  const who = (r.approver_name || nameFor(profiles, r.actor_id) || "").toLowerCase();
                  return (
                    who.includes(q) ||
                    (r.action || "").toLowerCase().includes(q) ||
                    (r.action_kind || "").toLowerCase().includes(q) ||
                    (r.comment || "").toLowerCase().includes(q)
                  );
                }
                const v = ev.row;
                const who = (nameFor(profiles, v.viewer_id) || "").toLowerCase();
                const file = (attachmentNames[v.attachment_id] || "").toLowerCase();
                const act = v.action === "download" ? "downloaded download" : "viewed view";
                return who.includes(q) || file.includes(q) || act.includes(q);
              })
            : allEvents
          ).sort((a, b) => +new Date(b.at) - +new Date(a.at));

          if (events.length === 0) {
            return (
              <p className="text-sm text-muted-foreground">
                {q
                  ? `No activity matches "${tlSearch}".`
                  : tlFilter === "all"
                  ? "No activity yet."
                  : tlFilter === "actions"
                  ? "No approval actions yet."
                  : "No document views or downloads yet."}
              </p>
            );
          }

          return (
            <ol className="relative ml-3 space-y-4 border-l-2 border-slate-200">
              {events.map((ev) => {
                if (ev.kind === "audit") {
                  const r = ev.row;
                  const kind = r.action_kind;
                  const tone =
                    kind === "approve" ? { bg: "bg-emerald-100", fg: "text-emerald-700", Icon: Check, label: "Approved" } :
                    kind === "reject" ? { bg: "bg-rose-100", fg: "text-rose-700", Icon: X, label: "Rejected" } :
                    kind === "back" ? { bg: "bg-sky-100", fg: "text-sky-700", Icon: Undo2, label: "Sent Back" } :
                    kind === "clarify" ? { bg: "bg-amber-100", fg: "text-amber-700", Icon: HelpCircle, label: "Clarification" } :
                    { bg: "bg-slate-100", fg: "text-slate-700", Icon: FileEdit, label: r.action };
                  return (
                    <li key={"a-" + r.id} className="relative pl-6">
                      <span className={`absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-background ${tone.bg}`}>
                        <tone.Icon className={`h-3.5 w-3.5 ${tone.fg}`} />
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium text-slate-800">{r.action}</span>
                        {r.level != null && <span className="text-xs text-slate-500">Level {r.level}</span>}
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <User className="h-3.5 w-3.5" />{r.approver_name || nameFor(profiles, r.actor_id)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />{new Date(r.at).toLocaleString()}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs italic text-slate-700">"{r.comment}"</p>
                      )}
                    </li>
                  );
                }
                const v = ev.row;
                const Icn = v.action === "download" ? DownloadIcon : Eye;
                return (
                  <li key={"v-" + v.id} className="relative pl-6">
                    <span className="absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full bg-indigo-100 ring-4 ring-background">
                      <Icn className="h-3.5 w-3.5 text-indigo-700" />
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-slate-800">
                        {v.action === "download" ? "Downloaded" : "Viewed"} document
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                        {attachmentNames[v.attachment_id] ?? "(removed file)"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <User className="h-3.5 w-3.5" />{nameFor(profiles, v.viewer_id)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />{new Date(v.viewed_at).toLocaleString()}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          );
        })()}
      </Card>


      {isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected") && approvers.length > 0 && (
        <Card className="border-sky-300 bg-sky-50 p-4">
          <h3 className="mb-2 font-semibold text-slate-800">Initiator Action</h3>
          <Textarea placeholder="Add a note for approvers (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3"><Button onClick={resubmit} disabled={busy} className="bg-yellow-300 text-slate-900 hover:bg-yellow-400">Resubmit for Approval</Button></div>
        </Card>
      )}

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