import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { COMPANIES, PLANTS, NFA_TYPES, FUNCTIONS, plantsFor, projectsFor } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Trash2, Plus, Save, Send, FileText, Building2, Users, Pencil, Sparkles, Paperclip, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authed/nfa/new")({
  component: NewNfaPage,
});

interface ApproverDraft { level: number; email: string; designation: string }

function NewNfaPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [company, setCompany] = useState("");
  const [plant, setPlant] = useState("");
  const [project, setProject] = useState("");
  const [nfaType, setNfaType] = useState("");
  const [func, setFunc] = useState("");
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [desc, setDesc] = useState("");
  const [approvers, setApprovers] = useState<ApproverDraft[]>([{ level: 1, email: "", designation: "" }]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File[]>([]);

  useEffect(() => { if (PLANTS.find((p) => p.code === plant)?.company !== company) setPlant(""); }, [company, plant]);

  function loadSample() {
    setCompany("REFL");
    setPlant("9064");
    setProject("P002");
    setNfaType("CAPEX");
    setFunc("PROJECTS");
    setSubject("Procurement of 250 KVA DG Set for Varthur Phase 2");
    setScope("Civil, Electrical and Project Operations at Varthur site");
    setBudget("42.5");
    setTimeline("60");
    setDesc(
      "Background: Existing 160 KVA DG set is undersized for Phase 2 load (estimated 210 KVA continuous).\n\n" +
        "Proposal: Procure a new 250 KVA Cummins DG set with AMF panel, acoustic enclosure and 990L fuel tank.\n\n" +
        "Alternatives considered:\n1. Hire on monthly rental — higher 3-year TCO (~1.6x).\n2. Upgrade existing set — OEM has declared end-of-life.\n\n" +
        "Recommendation: Approve CAPEX of INR 42.5 Lakhs; vendor finalisation via 3-bid process; delivery & commissioning within 60 days.",
    );
    // Use the signed-in user for every level so the sample is end-to-end actionable
    // without provisioning additional approver accounts. Replace with real approvers later.
    const selfEmail = user?.email ?? "demo@nfa.local";
    setApprovers([
      { level: 1, email: selfEmail, designation: "Projects Lead" },
      { level: 2, email: selfEmail, designation: "Head — Finance" },
      { level: 3, email: selfEmail, designation: "Chief Financial Officer" },
    ]);
    toast.success("Sample NFA loaded — review and submit");
  }

  function addLvl() {
    if (approvers.length >= 6) return;
    setApprovers([...approvers, { level: approvers.length + 1, email: "", designation: "" }]);
  }
  function removeLvl(i: number) {
    const next = approvers.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, level: idx + 1 }));
    setApprovers(next.length ? next : [{ level: 1, email: "", designation: "" }]);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const MAX = 20 * 1024 * 1024;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX) { toast.error(`${f.name} exceeds 20 MB and was skipped`); continue; }
      accepted.push(f);
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }
  function removeFile(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(asDraft: boolean) {
    if (!user) return;
    if (!company || !nfaType || !subject) return toast.error("Company, NFA Type and Subject are required");
    const validApprovers = approvers.filter((a) => a.email.trim());
    if (!asDraft && validApprovers.length === 0) return toast.error("Add at least one approver before submitting");
    setBusy(true);
    try {
      const plantObj = PLANTS.find((p) => p.code === plant);
      const { data: created, error } = await supabase.from("nfa").insert({
        initiator_id: user.id,
        company, plant: plant || null, plant_name: plantObj?.name ?? null,
        project: project || null, nfa_type: nfaType, function: func || null,
        subject, scope_impact: scope || null,
        budget_impact: budget ? Number(budget) : null,
        timeline_days: timeline ? Number(timeline) : null,
        detailed_description: desc || null,
        status: asDraft ? "with_initiator" : "in_process",
        current_level: asDraft ? 0 : 1,
      }).select().single();
      if (error || !created) throw error;

      if (validApprovers.length) {
        // Resolve approver emails to user ids via profiles
        const emails = validApprovers.map((a) => a.email.trim().toLowerCase());
        const { data: profs } = await supabase.from("profiles").select("id,email").in("email", emails);
        const map = new Map((profs ?? []).map((p) => [p.email?.toLowerCase(), p.id]));
        const missing = emails.filter((e) => !map.get(e));
        if (missing.length) {
          toast.error(`Approver(s) not found / never signed in: ${missing.join(", ")}`);
          await supabase.from("nfa").delete().eq("id", created.id);
          setBusy(false);
          return;
        }
        const rows = validApprovers.map((a) => ({
          nfa_id: created.id,
          level: a.level,
          approver_id: map.get(a.email.trim().toLowerCase())!,
          designation: a.designation || null,
        }));
        const { error: aerr } = await supabase.from("nfa_approver").insert(rows);
        if (aerr) throw aerr;
      }

      await supabase.from("nfa_audit").insert({
        nfa_id: created.id, actor_id: user.id,
        action: asDraft ? "Created (draft)" : "Submitted for approval",
      });

      // Upload staged attachments (best-effort: failures are surfaced but don't roll back the NFA).
      if (pending.length) {
        const uploaded: string[] = [];
        for (const file of pending) {
          const path = `${created.id}/${Date.now()}-${file.name}`;
          const { error: se } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
          if (se) { toast.error(`Upload failed for ${file.name}: ${se.message}`); continue; }
          const { error: ie } = await supabase.from("nfa_attachment").insert({
            nfa_id: created.id, storage_path: path, filename: file.name,
            mime: file.type || null, size: file.size, uploaded_by: user.id,
          });
          if (ie) { toast.error(`Record failed for ${file.name}: ${ie.message}`); continue; }
          uploaded.push(file.name);
        }
        if (uploaded.length) {
          await supabase.from("nfa_audit").insert({
            nfa_id: created.id, actor_id: user.id,
            action: `Attached ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`,
            comment: uploaded.join(", "),
          });
        }
      }

      toast.success(asDraft ? "Draft saved" : `Submitted: ${created.enfa_number}`);
      nav({ to: "/nfa/$id", params: { id: created.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Create Note For Approval"
        subtitle="Provide context, scope and impact — then route to the appropriate approver chain."
        actions={
          <>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={loadSample} disabled={busy}>
              <Sparkles className="h-4 w-4" /> Load Sample
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => submit(true)} disabled={busy}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => submit(false)} disabled={busy}>
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section icon={<Building2 className="h-4 w-4" />} title="Organisation & Type" desc="Master data is sourced from SAP.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company" required>
                <Select value={company} onValueChange={setCompany}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{COMPANIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="NFA Type" required>
                <Select value={nfaType} onValueChange={setNfaType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{NFA_TYPES.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Plant">
                <Select value={plant} onValueChange={setPlant} disabled={!company}>
                  <SelectTrigger><SelectValue placeholder={company ? "Select plant" : "Select company first"} /></SelectTrigger>
                  <SelectContent>{plantsFor(company).map((p) => <SelectItem key={p.code} value={p.code}>{p.code} – {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Project">
                <Select value={project} onValueChange={setProject} disabled={!plant}>
                  <SelectTrigger><SelectValue placeholder={plant ? "Select project" : "Select plant first"} /></SelectTrigger>
                  <SelectContent>{projectsFor(plant).map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Function" className="md:col-span-2">
                <Select value={func} onValueChange={setFunc}>
                  <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
                  <SelectContent>{FUNCTIONS.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Section icon={<FileText className="h-4 w-4" />} title="Note Details" desc="Subject, scope and impact assessment.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Subject" required className="md:col-span-2">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Concise one-line subject" />
              </Field>
              <Field label="Scope Impact" className="md:col-span-2">
                <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="What functional areas are impacted?" />
              </Field>
              <Field label="Budget Impact (Lakhs)">
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Timeline Impact (Days)">
                <Input type="number" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="0" />
              </Field>

              <Field label="Detailed Description" className="md:col-span-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Pencil className="h-4 w-4" />
                      {desc ? `Edit description (${desc.length} chars)` : "Add detailed description"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle className="font-display">Detailed Description</DialogTitle></DialogHeader>
                    <Textarea rows={12} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Provide a complete rationale, background, alternatives considered, and recommendation." />
                    <DialogFooter><Button>Done</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                {desc && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{desc}</p>}
              </Field>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-1">
         <div className="space-y-4">
          <Section icon={<Users className="h-4 w-4" />} title="Approver Chain" desc="Sequential approval — up to 6 levels.">
            <div className="space-y-3">
              {approvers.map((a, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{a.level}</span>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level {a.level}</span>
                    </div>
                    {approvers.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeLvl(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Approver email</Label>
                      <Input
                        placeholder="user@example.com"
                        value={a.email}
                        onChange={(e) => { const c = [...approvers]; c[i].email = e.target.value; setApprovers(c); }}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Designation</Label>
                      <Input
                        placeholder="e.g. CFO, Director — Projects"
                        value={a.designation}
                        onChange={(e) => { const c = [...approvers]; c[i].designation = e.target.value; setApprovers(c); }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLvl} disabled={approvers.length >= 6} className="w-full gap-1.5">
                <Plus className="h-4 w-4" /> Add approval level
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Approvers must have signed in at least once so we can resolve their account. When SAP user directory is connected this becomes a live search.
              </p>
            </div>
          </Section>

          <Section icon={<Paperclip className="h-4 w-4" />} title="Document Attachments" desc="Upload supporting documents — quotes, drawings, BOMs, photos.">
            <div className="space-y-3">
              <label className={"flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground transition " + (busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50 hover:border-primary/40")}>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div className="font-medium text-foreground">Click to upload or drop files</div>
                <div className="text-[11px]">PDF, images, Office docs · up to 20 MB each</div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                />
              </label>
              {pending.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  No files staged. Attachments upload when you Save Draft or Submit, and appear in the audit trail.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {pending.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">{f.type || "file"} · {(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeFile(i)} disabled={busy}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
         </div>
        </div>
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

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">{icon}</div>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold leading-tight">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}