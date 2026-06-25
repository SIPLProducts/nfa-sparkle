import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ApproverRow, type NfaRow, STATUS_LABEL, STATUS_TONE, APPROVER_TONE } from "@/lib/nfa-types";
import { NFA_TYPES, PLANTS, FUNCTIONS, nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Download, Play, BarChart3, RotateCcw } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";

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
    <div>
      <PageHeader
        eyebrow="Insights"
        title="E-NFA Report"
        subtitle="Filter, analyse and export Notes For Approval across the organisation."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground">Filters</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5"><Label className="text-xs">Plant</Label>
            <Select value={plant} onValueChange={(v) => setPlant(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All plants" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All plants</SelectItem>{PLANTS.map((p) => <SelectItem key={p.code} value={p.code}>{p.code} – {p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">ENFA Type</Label>
            <Select value={type} onValueChange={(v) => setType(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All types</SelectItem>{NFA_TYPES.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Function</Label>
            <Select value={func} onValueChange={(v) => setFunc(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All functions" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All functions</SelectItem>{FUNCTIONS.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">ENFA Number (contains)</Label><Input value={enfa} onChange={(e) => setEnfa(e.target.value)} placeholder="e.g. ENFA-00001" /></div>
          <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status:</span>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={inProcess} onCheckedChange={(v) => setInProc(!!v)} /> In Process</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={completed} onCheckedChange={(v) => setCompleted(!!v)} /> Completed</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={rejected} onCheckedChange={(v) => setRejected(!!v)} /> Rejected</label>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" onClick={() => { setPlant(""); setType(""); setFunc(""); setEnfa(""); setFrom(""); setTo(""); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button onClick={run} disabled={busy} className="flex-1 gap-1.5 sm:flex-none"><Play className="h-3.5 w-3.5" /> {busy ? "Running…" : "Execute"}</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} result{rows.length === 1 ? "" : "s"}</div>
      </div>

      {/* Mobile card list */}
      <div className="mt-2 space-y-2.5 md:hidden">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Run the report to see results.
          </div>
        )}
        {rows.map((r) => (
          <Link key={r.id} to="/nfa/$id" params={{ id: r.id }} className="block rounded-lg border border-border bg-card p-3 shadow-sm active:bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold text-accent">{r.enfa_number}</span>
              <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{r.subject}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {nfaTypeName(r.nfa_type)} · {r.plant ?? "—"} · {nameFor(profiles, r.initiator_id)} · {new Date(r.created_at).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-2 hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">ENFA Number</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Plant</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 font-medium">Initiator</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                {[1,2,3,4,5,6].map((l) => <th key={`s${l}`} className="px-3 py-2.5 font-medium">L{l}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={13} className="px-4 py-12 text-center text-sm text-muted-foreground">Run the report to see results.</td></tr>}
              {rows.map((r) => {
                const chain = approvers[r.id] ?? [];
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-mono text-xs font-medium text-accent">
                      <Link to="/nfa/$id" params={{ id: r.id }} className="hover:underline">{r.enfa_number}</Link>
                    </td>
                    <td className="px-3 py-2.5"><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.plant ? `${r.plant} · ${r.plant_name ?? ""}` : "—"}</td>
                    <td className="px-3 py-2.5">{nfaTypeName(r.nfa_type)}</td>
                    <td className="max-w-[260px] truncate px-3 py-2.5">{r.subject}</td>
                    <td className="px-3 py-2.5">{nameFor(profiles, r.initiator_id)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    {[1,2,3,4,5,6].map((l) => {
                      const a = chain.find((c) => c.level === l);
                      return (
                        <td key={`s${l}`} className="px-3 py-2.5">
                          {a ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate text-xs">{nameFor(profiles, a.approver_id)}</span>
                              <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + APPROVER_TONE[a.status]}>{a.status}</span>
                            </div>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
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