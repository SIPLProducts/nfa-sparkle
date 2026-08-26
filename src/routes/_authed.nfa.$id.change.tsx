import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, type NfaRow } from "@/lib/nfa-types";
import { NFA_TYPES, FUNCTIONS, nfaTypeName } from "@/lib/sap/master";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, htmlToPlainText } from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AttachmentList } from "@/components/AttachmentList";
import { toast } from "sonner";
import { ArrowLeft, Send, FileEdit, AlertCircle, Paperclip, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authed/nfa/$id/change")({
  component: ChangeRequestPage,
});

type EditableKey = "subject" | "scope_impact" | "budget_impact" | "timeline_days" | "nfa_type" | "function" | "detailed_description";

const FIELD_LABEL: Record<EditableKey, string> = {
  subject: "Subject",
  scope_impact: "Scope Impact",
  budget_impact: "Budget Impact (Lakhs)",
  timeline_days: "Timeline (Days)",
  nfa_type: "NFA Type",
  function: "Function",
  detailed_description: "Detailed Description",
};

function ChangeRequestPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [nfa, setNfa] = useState<NfaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [nfaType, setNfaType] = useState("");
  const [func, setFunc] = useState("");
  const [desc, setDesc] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [attachmentsKey, setAttachmentsKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("nfa").select("*").eq("id", id).maybeSingle();
      const n = (data as NfaRow) ?? null;
      setNfa(n);
      if (n) {
        setSubject(n.subject);
        setScope(n.scope_impact ?? "");
        setBudget(n.budget_impact?.toString() ?? "");
        setTimeline(n.timeline_days?.toString() ?? "");
        setNfaType(n.nfa_type);
        setFunc(n.function ?? "");
        setDesc(n.detailed_description ?? "");
      }
      setLoading(false);
    })();
  }, [id]);

  const diffs = useMemo(() => {
    if (!nfa) return [] as { key: EditableKey; from: string; to: string }[];
    const next: Record<EditableKey, string> = {
      subject,
      scope_impact: scope,
      budget_impact: budget,
      timeline_days: timeline,
      nfa_type: nfaType,
      function: func,
      detailed_description: desc,
    };
    const prev: Record<EditableKey, string> = {
      subject: nfa.subject ?? "",
      scope_impact: nfa.scope_impact ?? "",
      budget_impact: nfa.budget_impact?.toString() ?? "",
      timeline_days: nfa.timeline_days?.toString() ?? "",
      nfa_type: nfa.nfa_type ?? "",
      function: nfa.function ?? "",
      detailed_description: nfa.detailed_description ?? "",
    };
    return (Object.keys(next) as EditableKey[])
      .filter((k) => (next[k] ?? "") !== (prev[k] ?? ""))
      .map((k) => ({ key: k, from: prev[k], to: next[k] }));
  }, [nfa, subject, scope, budget, timeline, nfaType, func, desc]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!nfa) return <div className="p-6 text-sm text-muted-foreground">NFA not found.</div>;

  const isInitiator = user?.id === nfa.initiator_id;
  const canEdit = isInitiator && (nfa.status === "with_initiator" || nfa.status === "clarification" || nfa.status === "rejected");

  async function save(submit: boolean) {
    if (!user || !nfa) return;
    if (!canEdit) return toast.error("Changes are only allowed while the NFA is with the initiator.");
    if (diffs.length === 0 && !reason.trim() && pending.length === 0) {
      return toast.error("Make at least one change, attach a file, or add a change reason.");
    }
    if (submit && !reason.trim()) return toast.error("A change reason is required when resubmitting.");

    setBusy(true);
    try {
      const patch = {
        subject: subject.trim(),
        scope_impact: scope || null,
        budget_impact: budget ? Number(budget) : null,
        timeline_days: timeline ? Number(timeline) : null,
        nfa_type: nfaType,
        function: func || null,
        detailed_description: desc || null,
      };
      const { error: ue } = await supabase.from("nfa").update(patch).eq("id", nfa.id);
      if (ue) throw ue;

      // Upload any staged attachments and capture filenames for the audit trail.
      const uploadedNames: string[] = [];
      for (const file of pending) {
        const path = `${nfa.id}/${Date.now()}-${file.name}`;
        const { error: se } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
        if (se) throw se;
        const { error: ie } = await supabase.from("nfa_attachment").insert({
          nfa_id: nfa.id, storage_path: path, filename: file.name,
          mime: file.type || null, size: file.size, uploaded_by: user.id,
        });
        if (ie) throw ie;
        uploadedNames.push(file.name);
      }

      const parts: string[] = [];
      if (diffs.length) parts.push("fields: " + diffs.map((d) => FIELD_LABEL[d.key]).join(", "));
      if (uploadedNames.length) parts.push(`attachments: ${uploadedNames.join(", ")}`);
      const summary = parts.length ? "Change Request — " + parts.join(" · ") : "Change Request (no field changes)";
      await supabase.from("nfa_audit").insert({
        nfa_id: nfa.id, actor_id: user.id,
        action: summary, comment: reason || null,
      });

      if (submit) {
        const { error: re } = await supabase.rpc("nfa_resubmit", { _nfa_id: nfa.id, _comment: reason });
        if (re) throw re;
        toast.success("Changes submitted for approval");
      } else {
        toast.success("Changes saved");
      }
      // Refresh attachment list inline; navigate away only on submit.
      setPending([]);
      setAttachmentsKey((k) => k + 1);
      if (submit) nav({ to: "/nfa/$id", params: { id: nfa.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setPending((prev) => [...prev, ...Array.from(list)]);
  }
  function removeFile(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="NFA Change Request"
        subtitle={`Modify ${nfa.enfa_number} and resubmit to the approver chain.`}
        actions={
          <>
            <Link to="/nfa/$id" params={{ id: nfa.id }}>
              <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back to NFA</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={() => save(true)} disabled={busy || !canEdit}>
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm">
        <span className="text-muted-foreground">ENFA</span>
        <span className="font-mono font-semibold">{nfa.enfa_number}</span>
        <Badge variant="outline">{STATUS_LABEL[nfa.status]}</Badge>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Current type:</span>
        <span>{nfaTypeName(nfa.nfa_type)}</span>
      </div>

      {!canEdit && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {!isInitiator
              ? "Only the initiator of this NFA can raise a change request."
              : "Changes are blocked while the NFA is in approval. Ask an approver to send it back or request clarification, then return here."}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:col-span-2">
          <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary"><FileEdit className="h-4 w-4" /></div>
            <div>
              <h2 className="font-display text-sm font-bold leading-tight">Editable Fields</h2>
              <p className="text-xs text-muted-foreground">Organisation, plant and approver chain are not editable here.</p>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <Field label="Subject" className="md:col-span-2">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="NFA Type">
              <Select value={nfaType} onValueChange={setNfaType} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{NFA_TYPES.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Function">
              <Select value={func} onValueChange={setFunc} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
                <SelectContent>{FUNCTIONS.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Scope Impact" className="md:col-span-2">
              <Input value={scope} onChange={(e) => setScope(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Budget Impact (Lakhs)">
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Timeline (Days)">
              <Input type="number" value={timeline} onChange={(e) => setTimeline(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Detailed Description" className="md:col-span-2">
              {canEdit ? (
                <RichTextEditor value={desc} onChange={setDesc} minHeight="200px" placeholder="Revise the detailed description…" />
              ) : (
                <Textarea rows={8} value={htmlToPlainText(desc)} disabled />
              )}
            </Field>
            <Field label="Reason for Change" required className="md:col-span-2">
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what changed and why — visible to all approvers in the audit trail."
                disabled={!canEdit}
              />
            </Field>
            <div className="md:col-span-2">
              <Label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Supporting Attachments</span>
                <label className={"inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground shadow-sm " + (canEdit ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-50")}>
                  <Upload className="h-3.5 w-3.5" /> Add files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={!canEdit}
                    onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                  />
                </label>
              </Label>
              {pending.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                  No files staged. New attachments will upload when you save or submit, and their filenames will appear in the audit trail.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {pending.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">{f.type || "file"} · {(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => removeFile(i)} disabled={busy}>
                        <X className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <header className="border-b border-border bg-muted/40 px-5 py-3">
            <h2 className="font-display text-sm font-bold leading-tight">Change Summary</h2>
            <p className="text-xs text-muted-foreground">Differences against the saved NFA.</p>
          </header>
          <div className="p-5">
            {diffs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No changes yet. Edit any field on the left to see a diff here.</p>
            ) : (
              <ul className="space-y-3 text-xs">
                {diffs.map((d) => (
                  <li key={d.key} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="mb-1 font-medium uppercase tracking-wider text-[10px] text-muted-foreground">{FIELD_LABEL[d.key]}</div>
                    <div className="flex flex-col gap-1">
                      <div className="line-through text-rose-700/80 break-words">
                        {(d.key === "detailed_description" ? htmlToPlainText(d.from) : d.from) || "—"}
                      </div>
                      <div className="text-emerald-700 break-words">
                        {(d.key === "detailed_description" ? htmlToPlainText(d.to) : d.to) || "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Submitting will reset the approval chain to Level 1 and notify approvers that this is a revised NFA.
            </p>
            {pending.length > 0 && (
              <div className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground">{pending.length} attachment{pending.length === 1 ? "" : "s"} staged</div>
                <div className="mt-0.5">Filenames will be recorded in the audit history.</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-4">
        <AttachmentList
          nfaId={nfa.id}
          refreshKey={attachmentsKey}
          title="Existing Attachments"
          emptyText="No attachments uploaded yet. Use the section above to add files."
        />
      </div>
    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}