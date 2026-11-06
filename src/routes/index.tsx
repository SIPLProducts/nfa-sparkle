import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useScreenEntryEffect } from "@/hooks/use-screen-entry-effect";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardCounts } from "@/lib/dashboard-counts.functions";
import type { DashboardCounts } from "@/lib/sap/dashboard-counts";
import { SCREENS } from "@/lib/screens";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, type NfaRow, type NfaStatus, type ApproverRow } from "@/lib/nfa-types";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Inbox,
  Undo2,
  HelpCircle,
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
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NFA Portal — Dashboard" },
      { name: "description", content: "Create, approve and report Notes For Approval connected to SAP." },
      { property: "og:title", content: "NFA Portal — Dashboard" },
      { property: "og:description", content: "Create, approve and report Notes For Approval connected to SAP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading, canAccess, accessError, retryAccess } = useAuth();
  const nav = useNavigate();
  const [mine, setMine] = useState<NfaRow[]>([]);
  const [pending, setPending] = useState<{ nfa: NfaRow; ap: ApproverRow }[]>([]);
  const [, setFetchedAt] = useState(0);
  const [tab, setTab] = useState<"ongoing" | "completed">("ongoing");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const refreshIdRef = useRef(0);
  const fetchCounts = useServerFn(getDashboardCounts);
  const [sapCounts, setSapCounts] = useState<DashboardCounts | null>(null);
  const [countsError, setCountsError] = useState("");
  const [countsAttempt, setCountsAttempt] = useState(0);
  const dashboardAllowed = Boolean(user) && canAccess("dashboard");
  const firstAllowedPath = SCREENS.find(({ key }) => canAccess(key))?.path;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth", replace: true });
      return;
    }
    if (!canAccess("dashboard") && firstAllowedPath && firstAllowedPath !== "/") {
      nav({ to: firstAllowedPath, replace: true });
    }
  }, [loading, user, nav, canAccess, firstAllowedPath]);

  useEffect(() => {
    if (!user || !dashboardAllowed) return;
    let cancelled = false;
    setSapCounts(null); setCountsError("");
    fetchCounts()
      .then((r) => { if (!cancelled) { setSapCounts(r.counts); setCountsError(r.error); } })
      .catch((e) => { if (!cancelled) setCountsError(e instanceof Error ? e.message : "Could not load dashboard counts."); });
    return () => { cancelled = true; };
  }, [user, dashboardAllowed, fetchCounts, countsAttempt]);

  useScreenEntryEffect("/", () => {
    if (!user || !dashboardAllowed) return;
    setTab("ongoing");
    setSearch("");
    setDeptFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setFiltersOpen(false);
    setMine([]);
    setPending([]);
    setFetchedAt(0);
    setDataLoading(true);
    void (async () => {
      const refreshId = ++refreshIdRef.current;
      const { data: mineRows } = await supabase
        .from("nfa")
        .select("*")
        .eq("initiator_id", user.id)
        .order("created_at", { ascending: false });
      if (refreshId !== refreshIdRef.current) return;
      setMine(((mineRows as NfaRow[]) ?? []));

      const { data: aps } = await supabase.from("nfa_approver").select("*").eq("approver_id", user.id).eq("status", "pending");
      if (refreshId !== refreshIdRef.current) return;
      const list = (aps as ApproverRow[]) ?? [];
      setPending([]);
      if (list.length) {
        const { data: nfas } = await supabase.from("nfa").select("*").in("id", list.map((l) => l.nfa_id));
        if (refreshId !== refreshIdRef.current) return;
        const map = new Map(((nfas as NfaRow[]) ?? []).map((n) => [n.id, n]));
        setPending(
          list.flatMap((ap) => {
            const nfa = map.get(ap.nfa_id);
            if (!nfa || nfa.status !== "in_process" || nfa.current_level !== ap.level) return [];
            return [{ ap, nfa }];
          }),
        );
      }
      setFetchedAt(Date.now());
      setDataLoading(false);
    })();
    return () => {
      refreshIdRef.current += 1;
    };
  }, dashboardAllowed);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  if (!dashboardAllowed && !firstAllowedPath && accessError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <p>Unable to load your access. Please check your connection and try again.</p>
        <Button size="sm" onClick={retryAccess}>Retry</Button>
      </div>
    );
  }

  if (!dashboardAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {firstAllowedPath && firstAllowedPath !== "/" ? "Loading…" : "You do not have access to any screens. Please contact your administrator."}
      </div>
    );
  }

  const submittedCount = mine.length;
  const underReviewCount = mine.filter((r) => r.status === "in_process").length;
  void submittedCount;
  void underReviewCount;

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
  const advancedActive =
    deptFilter !== "all" || statusFilter !== "all" || dateFrom !== "" || dateTo !== "";
  const advancedCount =
    (deptFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (dateFrom !== "" ? 1 : 0) +
    (dateTo !== "" ? 1 : 0);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Kpi to="/approvals" icon={<Inbox className="h-5 w-5" />} label="Pending" caption="Awaiting your action" value={sapCounts?.pending ?? null} tone="pending" />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Approved" caption="Fully approved" value={sapCounts?.approved ?? null} tone="approved" />
        <Kpi icon={<XCircle className="h-5 w-5" />} label="Rejected" caption="Closed as rejected" value={sapCounts?.rejected ?? null} tone="rejected" />
        <Kpi to="/nfa/my" icon={<Undo2 className="h-5 w-5" />} label="Back to Initiator" caption="Returned for changes" value={sapCounts?.backToInitiator ?? null} tone="returned" />
        <Kpi to="/nfa/my" icon={<HelpCircle className="h-5 w-5" />} label="Clarification" caption="Clarification requested" value={sapCounts?.clarification ?? null} tone="clarify" />
      </div>
      {countsError ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Live counts unavailable: {countsError}{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => setCountsAttempt((n) => n + 1)}>Retry</button>
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick actions */}
        <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-1">
          <div className="kpi-pending absolute inset-x-0 top-0 h-1" />
          <div className="mb-4 flex items-center gap-3">
            <div className="kpi-pending grid h-9 w-9 place-items-center rounded-lg text-primary-foreground"><Zap className="h-4 w-4" /></div>
            <div>
              <h2 className="font-display text-base font-bold">Quick actions</h2>
              <p className="text-xs text-muted-foreground">Jump straight to common tasks</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <QuickAction to="/nfa/new" tone="kpi-pending" icon={<PlusCircle className="h-4 w-4" />} title="Create NFA" desc="Raise a new Note For Approval" />
            <QuickAction to="/nfa/my" tone="kpi-clarify" icon={<FileText className="h-4 w-4" />} title="Edit NFA" desc="Edit, upload, track status" />
            <QuickAction to="/approvals" tone="kpi-approved" icon={<Inbox className="h-4 w-4" />} title="Approvals inbox" desc="Approve · Reject · Send Back" />
            <QuickAction to="/report" tone="kpi-returned" icon={<BarChart3 className="h-4 w-4" />} title="E-NFA Report" desc="Filter & export NFAs" />
          </div>
        </section>

        {/* Pending approvals */}
        <section className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="kpi-clarify absolute inset-x-0 top-0 h-1" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="kpi-clarify grid h-9 w-9 place-items-center rounded-lg text-primary-foreground"><Inbox className="h-4 w-4" /></div>
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  Pending your approval
                  <span className="kpi-clarify rounded-full px-2 py-0.5 text-xs font-semibold text-primary-foreground">{pending.length}</span>
                </h2>
                <p className="text-xs text-muted-foreground">Items waiting on your decision</p>
              </div>
            </div>
            <Link to="/approvals" className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-accent/15">View inbox <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {pending.length === 0 ? (
            <EmptyRow text="You're all caught up." />
          ) : (
            <ul className="space-y-1.5">
              {pending.slice(0, 5).map(({ nfa, ap }) => (
                <li key={ap.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition hover:bg-muted/40">
                  <div className="min-w-0">
                    <Link to="/nfa/$id" params={{ id: nfa.id }} className="block truncate text-sm font-medium text-accent hover:underline">
                      {nfa.enfa_number} — {nfa.subject}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-primary">L{ap.level}</span>
                      {nfa.function ?? "—"} · {nfa.plant ?? "—"}
                    </div>
                  </div>
                  <Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm" variant="outline">Open</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* NFA Status Overview */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <StatusDoughnut
            data={[
              { name: "Pending", value: sapCounts?.pending ?? 0, color: "#0077BD" },
              { name: "Approved", value: sapCounts?.approved ?? 0, color: "#12803A" },
              { name: "Rejected", value: sapCounts?.rejected ?? 0, color: "#B42318" },
              { name: "Back to Initiator", value: sapCounts?.backToInitiator ?? 0, color: "#B85A0A" },
              { name: "Clarification", value: sapCounts?.clarification ?? 0, color: "#373435" },
            ]}
          />
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  caption,
  tone,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  caption: string;
  tone: keyof typeof KPI_TONES;
  to?: string;
}) {
  const Wrap: any = to ? Link : "div";
  const wrapProps: any = to ? { to } : {};
  const t = KPI_TONES[tone];
  return (
    <Wrap
      {...wrapProps}
      className={
        "group relative block overflow-hidden rounded-xl p-4 pl-5 text-status-ink transition " + t.card + " " +
        (to ? "hover:-translate-y-0.5 hover:shadow-md" : "")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-status-ink/90 leading-tight">{label}</div>
          <div className={"font-display mt-2 text-3xl font-bold leading-none tabular-nums text-status-ink"}>{value ?? "—"}</div>
          <div className="mt-2 text-xs text-status-ink/80">{caption}</div>
        </div>
        <div className={"grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-status-ink/30 bg-status-ink/20 text-status-ink"}>{icon}</div>
      </div>
    </Wrap>
  );
}

const KPI_TONES = {
  pending: { card: "kpi-pending" },
  approved: { card: "kpi-approved" },
  rejected: { card: "kpi-rejected" },
  returned: { card: "kpi-returned" },
  clarify: { card: "kpi-clarify" },
} as const;

function StatusReportTable({
  rows,
  emptyText,
  filtersActive,
  onClearFilters,
}: {
  rows: NfaRow[];
  emptyText: string;
  filtersActive?: boolean;
  onClearFilters?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [rows.length, pageSize]);
  if (rows.length === 0) {
    if (filtersActive) {
      return (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
            <FilterX className="h-5 w-5" />
          </div>
          <div className="mt-3 text-sm font-medium">No NFAs match your filters</div>
          <div className="mt-1 max-w-sm text-xs text-muted-foreground">
            Try broadening the date range, changing the department, or clearing status.
          </div>
          {onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-3 h-8 gap-1 text-xs">
              <X className="h-3.5 w-3.5" /> Clear all filters
            </Button>
          )}
        </div>
      );
    }
    return <EmptyRow text={emptyText} />;
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const end = Math.min(start + pageSize, rows.length);
  const pageRows = rows.slice(start, end);
  return (
    <div className="space-y-2">
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
          {pageRows.map((r, i) => (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{start + i + 1}</td>
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="tabular-nums">
          {start + 1}–{end} of {rows.length}
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden sm:inline">Rows</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Rows per page"
          >
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="tabular-nums">{current} / {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={current >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, title, desc, tone }: { to: string; icon: React.ReactNode; title: string; desc: string; tone: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md">
      <div className={tone + " grid h-10 w-10 shrink-0 place-items-center rounded-lg text-primary-foreground"}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" />
    </Link>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></div>
      <div className="text-sm font-semibold">{text}</div>
      <div className="mt-1 text-xs text-muted-foreground">New approval requests will appear here.</div>
    </div>
  );
}

function StatusReportSkeleton() {
  return (
    <div className="space-y-3">
      {/* Filter bar skeleton */}
      <div className="hidden md:grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={"h-9 animate-pulse rounded-md bg-muted " + (i === 0 ? "col-span-2" : "")} />
        ))}
      </div>
      <div className="flex items-center gap-2 md:hidden">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      {/* Tab skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-md border border-border">
        <div className="h-9 border-b border-border bg-muted/50" />
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <div className="h-4 w-6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="hidden sm:block h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="hidden sm:block h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusDoughnut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const chartData = total > 0 ? data.filter((d) => d.value > 0) : [{ name: "None", value: 1, color: "var(--muted)" }];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">NFA Status Overview</h2>
          <p className="text-xs text-muted-foreground">Status-wise distribution of NFAs</p>
        </div>
        <Link to="/report" className="text-xs font-medium text-accent hover:underline">Full report <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
      </div>
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
        <div className="relative mx-auto h-64 w-full max-w-xs">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={total > 0 && chartData.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" isAnimationActive>
                {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              {total > 0 && <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold">{total}</span>
            <span className="text-xs text-muted-foreground">{total > 0 ? "Total NFAs" : "No NFAs yet"}</span>
          </div>
        </div>
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
              <span className="text-sm">
                <span className="font-bold">{d.value}</span>
                <span className="ml-2 text-xs text-muted-foreground">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
