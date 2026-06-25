import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { COMPANIES, PLANTS, PROJECTS, NFA_TYPES, FUNCTIONS, plantsFor, projectsFor } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

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

  useEffect(() => { if (PLANTS.find((p) => p.code === plant)?.company !== company) setPlant(""); }, [company, plant]);

  function addLvl() {
    if (approvers.length >= 6) return;
    setApprovers([...approvers, { level: approvers.length + 1, email: "", designation: "" }]);
  }
  function removeLvl(i: number) {
    const next = approvers.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, level: idx + 1 }));
    setApprovers(next.length ? next : [{ level: 1, email: "", designation: "" }]);
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

      toast.success(asDraft ? "Draft saved" : `Submitted: ${created.enfa_number}`);
      nav({ to: "/nfa/$id", params: { id: created.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-slate-300">
      <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center text-base font-bold italic text-slate-800">
        NOTE FOR APPROVAL
      </div>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          <Field label="Company" required>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="bg-yellow-50"><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{COMPANIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Project / Plant">
            <div className="grid grid-cols-2 gap-2">
              <Select value={plant} onValueChange={setPlant} disabled={!company}>
                <SelectTrigger><SelectValue placeholder="Plant" /></SelectTrigger>
                <SelectContent>{plantsFor(company).map((p) => <SelectItem key={p.code} value={p.code}>{p.code} – {p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={project} onValueChange={setProject} disabled={!plant}>
                <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>{projectsFor(plant).map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="NFA Type" required>
            <Select value={nfaType} onValueChange={setNfaType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{NFA_TYPES.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Function">
            <Select value={func} onValueChange={setFunc}>
              <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
              <SelectContent>{FUNCTIONS.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Subject" required className="md:col-span-2">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Scope Impact" className="md:col-span-2">
            <Input value={scope} onChange={(e) => setScope(e.target.value)} />
          </Field>
          <Field label="Budget Impact (Lakhs)">
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          <Field label="Timeline Impact (Days)">
            <Input type="number" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
          </Field>

          <Field label="Detailed Description" className="md:col-span-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-yellow-100 text-slate-800 hover:bg-yellow-200">
                  Detailed Description {desc ? `(${desc.length} chars)` : ""}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Detailed Description</DialogTitle></DialogHeader>
                <Textarea rows={10} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </DialogContent>
            </Dialog>
          </Field>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Approver Chain (up to 6 levels)</h3>
            <Button variant="outline" size="sm" onClick={addLvl} disabled={approvers.length >= 6}>+ Add level</Button>
          </div>
          <div className="space-y-2">
            {approvers.map((a, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                <div className="col-span-1 text-sm font-medium text-slate-600">Level {a.level}</div>
                <div className="col-span-5">
                  <Label className="text-xs">Approver email</Label>
                  <Input
                    placeholder="user@example.com"
                    value={a.email}
                    onChange={(e) => { const c = [...approvers]; c[i].email = e.target.value; setApprovers(c); }}
                  />
                </div>
                <div className="col-span-5">
                  <Label className="text-xs">Designation</Label>
                  <Input
                    placeholder="e.g. DIRE-PROJ, CFO, GRP. CFO"
                    value={a.designation}
                    onChange={(e) => { const c = [...approvers]; c[i].designation = e.target.value; setApprovers(c); }}
                  />
                </div>
                <Button variant="ghost" size="sm" className="col-span-1 text-red-600" onClick={() => removeLvl(i)}>Remove</Button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Approvers must have signed in at least once so we can resolve their account. (When SAP user directory is connected this becomes a live search.)
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Button variant="outline" onClick={() => submit(true)} disabled={busy}>Save Draft</Button>
          <Button onClick={() => submit(false)} disabled={busy} className="bg-yellow-300 text-slate-900 hover:bg-yellow-400">
            Submit for Approval
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-sm text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>
      {children}
    </div>
  );
}