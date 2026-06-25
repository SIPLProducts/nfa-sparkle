import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ApproverRow, type NfaRow, STATUS_LABEL } from "@/lib/nfa-types";
import { NFA_TYPES, PLANTS, FUNCTIONS, nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/report")({
  component: Report,
});

function Report() {
  const [plant, setPlant] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [func, setFunc] = useState<string>("");
  const [enfa, setEnfa] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [inProcess, setInProc] = useState(true);
  const [completed, setCompleted] = useState(true);
  const [rejected, setRejected] = useState(true);
  const [rows, setRows] = useState<NfaRow[]>([]);
  const [approvers, setApprovers] = useState<Record<string, ApproverRow[]>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    let q = supabase.from("nfa").select("*").order("created_at", { ascending: false }).limit(500);
    if (plant) q = q.eq("plant", plant);
    if (type) q = q.eq("nfa_type", type);
    if (func) q = q.eq("function", func);
    if (enfa) q = q.ilike("enfa_number", `%${enfa}%`);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", new Date(new Date(to).getTime() + 86400000).toISOString());
    const statuses: NfaRow["status"][] = [];
    if (inProcess) statuses.push("in_process", "with_initiator", "clarification");
    if (completed) statuses.push("completed");
    if (rejected) statuses.push("rejected");
    if (statuses.length) q = q.in("status", statuses);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setBusy(false); return; }
    const list = (data as NfaRow[]) ?? [];
    setRows(list);
    if (list.length) {
      const ids = list.map((n) => n.id);
      const { data: aps } = await supabase.from("nfa_approver").select("*").in("nfa_id", ids).order("level");
      const m: Record<string, ApproverRow[]> = {};
      for (const r of (aps as ApproverRow[]) ?? []) (m[r.nfa_id] ||= []).push(r);
      setApprovers(m);
      setProfiles(await fetchProfilesMap([
        ...list.map((n) => n.initiator_id),
        ...(((aps as ApproverRow[]) ?? []).map((a) => a.approver_id)),
      ]));
    } else { setApprovers({}); }
    setBusy(false);
  }

  function exportCsv() {
    if (!rows.length) return;
    const cols = ["ENFA Number","Status","Plant","Plant Name","NFA Type","Function","Subject","Initiator","Creation Date","Budget (Lakhs)","Timeline (Days)"];
    const lines = [cols.join(",")];
    for (const r of rows) {
      const vals = [r.enfa_number, STATUS_LABEL[r.status], r.plant ?? "", r.plant_name ?? "", nfaTypeName(r.nfa_type), r.function ?? "", r.subject, nameFor(profiles, r.initiator_id), new Date(r.created_at).toLocaleDateString(), r.budget_impact ?? "", r.timeline_days ?? ""];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `enfa-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-300 p-4">
        <h2 className="mb-3 text-lg font-bold italic text-slate-700">E-NFA Report</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><Label>Plant</Label>
            <Select value={plant} onValueChange={(v) => setPlant(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All</SelectItem>{PLANTS.map((p) => <SelectItem key={p.code} value={p.code}>{p.code} – {p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>ENFA Type</Label>
            <Select value={type} onValueChange={(v) => setType(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All</SelectItem>{NFA_TYPES.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Function</Label>
            <Select value={func} onValueChange={(v) => setFunc(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All</SelectItem>{FUNCTIONS.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>ENFA No (contains)</Label><Input value={enfa} onChange={(e) => setEnfa(e.target.value)} /></div>
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={inProcess} onCheckedChange={(v) => setInProc(!!v)} /> In Process</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={completed} onCheckedChange={(v) => setCompleted(!!v)} /> Completed</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={rejected} onCheckedChange={(v) => setRejected(!!v)} /> Rejected</label>
          <div className="ml-auto flex gap-2">
            <Button onClick={run} disabled={busy}>Execute</Button>
            <Button onClick={exportCsv} variant="outline" disabled={rows.length === 0}>Export CSV</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto border-slate-300 p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-200 text-left text-xs uppercase text-slate-700">
            <tr>
              <th className="p-2">ENFA Number</th><th className="p-2">Status</th><th className="p-2">Plant</th><th className="p-2">Plant Name</th>
              <th className="p-2">NFA Type</th><th className="p-2">Function</th><th className="p-2">Subject</th><th className="p-2">Initiator</th><th className="p-2">Date</th>
              {[1,2,3,4,5,6].map((l) => (<><th key={`d${l}`} className="p-2">Desig{l}</th><th key={`a${l}`} className="p-2">Approver{l}</th><th key={`s${l}`} className="p-2">Status{l}</th></>))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 && <tr><td colSpan={27} className="p-3 text-slate-500">Run the report to see results.</td></tr>}
            {rows.map((r) => {
              const chain = approvers[r.id] ?? [];
              return (
                <tr key={r.id} className="hover:bg-sky-50">
                  <td className="p-2 font-medium text-sky-700"><Link to="/nfa/$id" params={{ id: r.id }}>{r.enfa_number}</Link></td>
                  <td className="p-2">{STATUS_LABEL[r.status]}</td>
                  <td className="p-2">{r.plant}</td><td className="p-2">{r.plant_name}</td>
                  <td className="p-2">{nfaTypeName(r.nfa_type)}</td><td className="p-2">{r.function}</td>
                  <td className="p-2">{r.subject}</td>
                  <td className="p-2">{nameFor(profiles, r.initiator_id)}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                  {[1,2,3,4,5,6].map((l) => {
                    const a = chain.find((c) => c.level === l);
                    return (<>
                      <td key={`d${l}`} className="p-2">{a?.designation ?? ""}</td>
                      <td key={`a${l}`} className="p-2">{a ? nameFor(profiles, a.approver_id) : ""}</td>
                      <td key={`s${l}`} className="p-2">{a?.status ?? ""}</td>
                    </>);
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}