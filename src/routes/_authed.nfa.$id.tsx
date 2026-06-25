import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, type ApproverRow, type NfaRow } from "@/lib/nfa-types";
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
import { Upload, ArrowLeft, FileEdit, Check, X, Undo2, HelpCircle, Clock, User, Filter } from "lucide-react";
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
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [fAction, setFAction] = useState<string>("all");
  const [fApprover, setFApprover] = useState<string>("");
  const [fLevel, setFLevel] = useState<string>("all");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");

  const load = useCallback(async () => {
    const { data: n } = await supabase.from("nfa").select("*").eq("id", id).maybeSingle();
    setNfa((n as NfaRow) ?? null);
    const { data: a } = await supabase.from("nfa_approver").select("*").eq("nfa_id", id).order("level");
    setApprovers((a as ApproverRow[]) ?? []);
    const { data: au } = await supabase.from("nfa_audit").select("*").eq("nfa_id", id).order("at", { ascending: false });
    setAudit((au as AuditRow[]) ?? []);
    const ids = [n?.initiator_id, ...((a ?? []).map((r) => r.approver_id)), ...((au ?? []).map((r) => r.actor_id))].filter((x): x is string => Boolean(x));
    setProfiles(await fetchProfilesMap(ids));
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
          <Badge variant="outline">{STATUS_LABEL[nfa.status]}</Badge>
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
                <td className="p-2"><Badge variant="outline">{a.status}</Badge></td>
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

      <div className="flex items-center justify-end">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted">
          <Upload className="h-4 w-4" /> Upload Attachment
          <input type="file" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.currentTarget.value = ""; }} disabled={busy} />
        </label>
      </div>
      <AttachmentList nfaId={nfa.id} refreshKey={attachmentsKey} />

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
        <h3 className="mb-3 font-semibold text-slate-700">Audit Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-700">
              <tr>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Action</th>
                <th className="p-2">Level</th>
                <th className="p-2">Approver / Actor</th>
                <th className="p-2">Status Change</th>
                <th className="p-2">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {audit.map((a) => {
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
                          <Badge variant="outline" className="font-normal">{STATUS_LABEL[a.old_status as keyof typeof STATUS_LABEL] ?? a.old_status}</Badge>
                          <span className="text-slate-400">→</span>
                          <Badge variant="outline" className="font-normal">{STATUS_LABEL[a.new_status as keyof typeof STATUS_LABEL] ?? a.new_status}</Badge>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2 italic text-slate-600">{a.comment ?? ""}</td>
                  </tr>
                );
              })}
              {audit.length === 0 && (
                <tr><td colSpan={6} className="p-3 text-center text-slate-500">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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