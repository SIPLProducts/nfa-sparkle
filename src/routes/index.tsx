import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, type NfaRow, type NfaStatus, type ApproverRow } from "@/lib/nfa-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Inbox,
  BarChart3,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  XCircle,
  Send,
  Search,
  X,
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
  const [tab, setTab] = useState<"ongoing" | "completed">("ongoing");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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
        .order("created_at", { ascending: false });
      setMine(((mineRows as NfaRow[]) ?? []));

      const { data: aps } = await supabase.from("nfa_approver").select("*").eq("approver_id", user.id).eq("status", "pending");
      const list = (aps as ApproverRow[]) ?? [];
      if (list.length) {
        const { data: nfas } = await supabase.from("nfa").select("*").in("id", list.map((l) => l.nfa_id));
        const map = new Map(((nfas as NfaRow[]) ?? []).map((n) => [n.id, n]));
        setPending(
          list
            .map((ap) => ({ ap, nfa: map.get(ap.nfa_id)! }))
            .filter((r) => r.nfa && r.nfa.status === "in_process" && r.nfa.current_level === r.ap.level),
        );
      }
    })();
  }, [user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }

  const submittedCount = mine.length;
  const underReviewCount = mine.filter((r) => r.status === "in_process").length;
  const approvedCount = mine.filter((r) => r.status === "completed").length;
  const rejectedCount = mine.filter((r) => r.status === "rejected").length;

  const ONGOING: NfaStatus[] = ["with_initiator", "in_process", "clarification"];
  const COMPLETED: NfaStatus[] = ["completed", "rejected"];

  const departments = Array.from(new Set(mine.map((r) => r.function).filter(Boolean))) as string[];
  const statusOptionsFor = (scope: "ongoing" | "completed") =>
    scope === "ongoing" ? ONGOING : COMPLETED;

  const applyFilters = (rows: NfaRow[]) => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (deptFilter !== "all" && (r.function ?? "") !== deptFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (from || to) {
        const t = new Date(r.created_at).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      if (q) {
        const hay = `${r.enfa_number ?? ""} ${r.subject ?? ""} ${r.function ?? ""} ${r.plant ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const ongoingRows = applyFilters(mine.filter((r) => ONGOING.includes(r.status)));
  const completedRows = applyFilters(mine.filter((r) => COMPLETED.includes(r.status)));

  const filtersActive =
    search.trim() !== "" || deptFilter !== "all" || statusFilter !== "all" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => {
    setSearch("");
    setDeptFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          to="/approvals"
          icon={<Inbox className="h-5 w-5" />}
          label="Pending With Me"
          value={pending.length}
          tile="from-sky-500 to-blue-700"
          chip="bg-white/20 text-white ring-white/30"
        />
        <Kpi
          to="/nfa/my"
          icon={<Send className="h-5 w-5" />}
          label="My Submitted NFAs"
          value={submittedCount}
          tile="from-indigo-500 to-violet-700"
          chip="bg-white/20 text-white ring-white/30"
        />
        <Kpi
          icon={<Clock className="h-5 w-5" />}
          label="NFAs Under Review"
          value={underReviewCount}
          tile="from-amber-400 to-orange-600"
          chip="bg-white/25 text-white ring-white/30"
        />
        <Kpi
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved NFAs"
          value={approvedCount}
          tile="from-emerald-500 to-teal-700"
          chip="bg-white/20 text-white ring-white/30"
        />
        <Kpi
          icon={<XCircle className="h-5 w-5" />}
          label="Rejected NFAs"
          value={rejectedCount}
          tile="from-rose-500 to-red-700"
          chip="bg-white/20 text-white ring-white/30"
        />
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
              <p className="text-xs text-muted-foreground">Items waiting on your decision ({pending.length})</p>
            </div>
            <Link to="/approvals" className="text-xs font-medium text-accent hover:underline">View inbox <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          {pending.length === 0 ? (
            <EmptyRow text="You're all caught up." />
          ) : (
            <ul className="divide-y divide-border">
              {pending.slice(0, 5).map(({ nfa, ap }) => (
                <li key={ap.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link to="/nfa/$id" params={{ id: nfa.id }} className="block truncate text-sm font-medium text-accent hover:underline">
                      {nfa.enfa_number} — {nfa.subject}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">{nfa.function ?? "—"} · {nfa.plant ?? "—"} · L{ap.level}</div>
                  </div>
                  <Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm" variant="outline">Open</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* NFA Status Report */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold">NFA Status Report</h2>
              <p className="text-xs text-muted-foreground">
                Ongoing ({ongoingRows.length}) &middot; Completed ({completedRows.length})
              </p>
            </div>
            <Link to="/report" className="text-xs font-medium text-accent hover:underline">Full report <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          {mine.length === 0 ? (
            <EmptyRow text="No NFAs yet — create your first one." />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "ongoing" | "completed")}>
              {/* Filters */}
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <div className="relative sm:col-span-2 lg:col-span-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search subject, eNFA #, plant…"
                    className="h-9 pl-8"
                  />
                </div>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptionsFor(tab).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9"
                  aria-label="From date"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9"
                  aria-label="To date"
                />
              </div>
              {filtersActive && (
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Showing filtered results</span>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 px-2 text-xs">
                    <X className="h-3 w-3" /> Clear filters
                  </Button>
                </div>
              )}
              <TabsList className="mb-3">
                <TabsTrigger value="ongoing" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Ongoing
                  <span className="ml-1 rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-700">{ongoingRows.length}</span>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                  <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">{completedRows.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ongoing" className="mt-0">
                <StatusReportTable rows={ongoingRows} emptyText="No ongoing NFAs." />
              </TabsContent>
              <TabsContent value="completed" className="mt-0">
                <StatusReportTable rows={completedRows} emptyText="No completed NFAs yet." />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  tile,
  chip,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tile: string;
  chip: string;
  to?: string;
}) {
  const Wrap: any = to ? Link : "div";
  const wrapProps: any = to ? { to } : {};
  return (
    <Wrap
      {...wrapProps}
      className={
        "relative block overflow-hidden rounded-lg p-4 text-white shadow-md ring-1 ring-white/10 bg-gradient-to-br transition hover:-translate-y-0.5 hover:shadow-lg " +
        tile
      }
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-wider text-white/80">
            {label}
          </div>
          <div className="font-display mt-1 text-3xl font-bold leading-none">{value}</div>
        </div>
        <div className={"grid h-10 w-10 shrink-0 place-items-center rounded-md ring-1 " + chip}>
          {icon}
        </div>
      </div>
    </Wrap>
  );
}

function StatusReportTable({ rows, emptyText }: { rows: NfaRow[]; emptyText: string }) {
  if (rows.length === 0) return <EmptyRow text={emptyText} />;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Sl. No.</th>
            <th className="px-3 py-2 font-medium">Department</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium text-right">Financial Impact</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">NFA Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5">{r.function ?? "—"}</td>
              <td className="max-w-[360px] truncate px-3 py-2.5">
                <Link to="/nfa/$id" params={{ id: r.id }} className="text-accent hover:underline">
                  {r.enfa_number} — {r.subject}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.budget_impact != null
                  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(r.budget_impact))
                  : "—"}
              </td>
              <td className="px-3 py-2.5">
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + STATUS_TONE[r.status]}>
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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