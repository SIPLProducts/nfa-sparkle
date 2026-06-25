import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, type NfaRow, type ApproverRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Inbox,
  BarChart3,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NFA Portal — Dashboard" },
      { name: "description", content: "Create, approve and report Notes For Approval connected to SAP." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mine, setMine] = useState<NfaRow[]>([]);
  const [pending, setPending] = useState<{ nfa: NfaRow; ap: ApproverRow }[]>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth", replace: true });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mineRows } = await supabase
        .from("nfa")
        .select("*")
        .eq("initiator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setMine(((mineRows as NfaRow[]) ?? []));

      const { data: aps } = await supabase.from("nfa_approver").select("*").eq("approver_id", user.id).eq("status", "pending");
      const list = (aps as ApproverRow[]) ?? [];
      if (list.length) {
        const { data: nfas } = await supabase.from("nfa").select("*").in("id", list.map((l) => l.nfa_id));
        const map = new Map(((nfas as NfaRow[]) ?? []).map((n) => [n.id, n]));
        setPending(
          list
            .map((ap) => ({ ap, nfa: map.get(ap.nfa_id)! }))
            .filter((r) => r.nfa && r.nfa.status === "in_process" && r.nfa.current_level === r.ap.level)
            .slice(0, 5),
        );
      }
    })();
  }, [user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }

  const inProcessCount = mine.filter((r) => r.status === "in_process").length;
  const completedCount = mine.filter((r) => r.status === "completed").length;
  const clarificationCount = mine.filter((r) => r.status === "clarification" || r.status === "with_initiator").length;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Note For Approval — overview & worklists"
      actions={
        <div className="flex gap-2">
          <Link to="/nfa/new"><Button size="sm" className="gap-1.5"><PlusCircle className="h-4 w-4" /> Create NFA</Button></Link>
        </div>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<Inbox className="h-4 w-4" />} label="Awaiting your action" value={pending.length} accent="text-blue-700 bg-blue-50 ring-blue-200" />
        <Kpi icon={<Clock className="h-4 w-4" />} label="My NFAs in process" value={inProcessCount} accent="text-indigo-700 bg-indigo-50 ring-indigo-200" />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Needs clarification" value={clarificationCount} accent="text-amber-800 bg-amber-50 ring-amber-200" />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Completed (recent)" value={completedCount} accent="text-emerald-700 bg-emerald-50 ring-emerald-200" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick actions */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Quick actions</h2>
          </div>
          <div className="space-y-2">
            <QuickAction to="/nfa/new" icon={<PlusCircle className="h-4 w-4" />} title="Create NFA" desc="Raise a new Note For Approval" />
            <QuickAction to="/nfa/my" icon={<FileText className="h-4 w-4" />} title="My NFAs" desc="Edit, upload, track status" />
            <QuickAction to="/approvals" icon={<Inbox className="h-4 w-4" />} title="Approvals inbox" desc="Approve · Reject · Send Back" />
            <QuickAction to="/report" icon={<BarChart3 className="h-4 w-4" />} title="E-NFA Report" desc="Filter & export NFAs" />
          </div>
        </section>

        {/* Pending approvals */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">Pending your approval</h2>
              <p className="text-xs text-muted-foreground">Top 5 items waiting on you</p>
            </div>
            <Link to="/approvals" className="text-xs font-medium text-accent hover:underline">View inbox <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          {pending.length === 0 ? (
            <EmptyRow text="You're all caught up." />
          ) : (
            <ul className="divide-y divide-border">
              {pending.map(({ nfa, ap }) => (
                <li key={ap.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link to="/nfa/$id" params={{ id: nfa.id }} className="block truncate text-sm font-medium text-accent hover:underline">
                      {nfa.enfa_number} — {nfa.subject}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">{nfaTypeName(nfa.nfa_type)} · {nfa.plant ?? "—"} · L{ap.level}</div>
                  </div>
                  <Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm" variant="outline">Open</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent NFAs */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">My recent NFAs</h2>
              <p className="text-xs text-muted-foreground">Latest 5 NFAs you initiated</p>
            </div>
            <Link to="/nfa/my" className="text-xs font-medium text-accent hover:underline">View all <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          {mine.length === 0 ? (
            <EmptyRow text="No NFAs yet — create your first one." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">ENFA Number</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mine.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="py-2.5 pr-3 font-mono text-xs text-accent">
                        <Link to="/nfa/$id" params={{ id: r.id }} className="hover:underline">{r.enfa_number}</Link>
                      </td>
                      <td className="py-2.5 pr-3">{r.subject}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{nfaTypeName(r.nfa_type)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + STATUS_TONE[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-md ring-1 " + accent}>{icon}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition hover:border-accent hover:bg-muted/40">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">{text}</div>;
}