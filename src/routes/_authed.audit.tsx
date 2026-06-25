import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Search, Filter, Loader2, Inbox, ExternalLink, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authed/audit")({
  component: AuditLogs,
});

interface AuditRow {
  id: string;
  nfa_id: string;
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

interface NfaLite { id: string; enfa_number: string | null; subject: string | null }

function AuditLogs() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nfas, setNfas] = useState<Record<string, NfaLite>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [fKind, setFKind] = useState<string>("all");
  const [fLevel, setFLevel] = useState<string>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: au } = await supabase
        .from("nfa_audit")
        .select("*")
        .order("at", { ascending: false })
        .limit(1000);
      const list = (au as AuditRow[]) ?? [];
      setRows(list);
      const nfaIds = Array.from(new Set(list.map((r) => r.nfa_id)));
      if (nfaIds.length) {
        const { data: ns } = await supabase
          .from("nfa")
          .select("id,enfa_number,subject")
          .in("id", nfaIds);
        const map: Record<string, NfaLite> = {};
        for (const n of (ns ?? []) as NfaLite[]) map[n.id] = n;
        setNfas(map);
      }
      const actorIds = list.map((r) => r.actor_id).filter((x): x is string => Boolean(x));
      setProfiles(await fetchProfilesMap(actorIds));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fKind !== "all" && (r.action_kind ?? "") !== fKind) return false;
      if (fLevel !== "all" && String(r.level ?? "") !== fLevel) return false;
      if (fFrom && new Date(r.at) < new Date(fFrom)) return false;
      if (fTo && new Date(r.at) > new Date(fTo + "T23:59:59")) return false;
      if (q) {
        const hay = [
          r.action,
          r.comment,
          r.approver_name,
          nfas[r.nfa_id]?.enfa_number,
          nfas[r.nfa_id]?.subject,
          nameFor(profiles, r.actor_id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, fKind, fLevel, fFrom, fTo, nfas, profiles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const reset = () => { setQ(""); setFKind("all"); setFLevel("all"); setFFrom(""); setFTo(""); setPage(1); };

  const kindTone = (k: string | null) => {
    switch (k) {
      case "approve": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "reject": return "bg-rose-50 text-rose-700 border-rose-200";
      case "clarify": return "bg-amber-50 text-amber-700 border-amber-200";
      case "back": return "bg-sky-50 text-sky-700 border-sky-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <AppShell title="Audit Logs" subtitle="System-wide activity across all NFAs you can access">
      <PageHeader
        title="Audit Logs"
        subtitle="Track creations, changes, approvals, rejections, clarifications and resubmissions."
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-8" placeholder="NFA #, subject, action, comment, actor…" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={fKind} onValueChange={(v) => { setFKind(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="clarify">Clarification</SelectItem>
                <SelectItem value="back">Back</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Level</Label>
            <Select value={fLevel} onValueChange={(v) => { setFLevel(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {[1,2,3,4,5,6].map((l) => <SelectItem key={l} value={String(l)}>L{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {filtered.length} of {rows.length} entries
          </div>
          <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">NFA</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Comment</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const n = nfas[r.nfa_id];
                return (
                  <tr key={r.id} className="border-t border-border align-top hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{n?.enfa_number ?? r.nfa_id.slice(0, 8)}</div>
                      <div className="max-w-[260px] truncate text-xs text-muted-foreground">{n?.subject ?? ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={kindTone(r.action_kind)}>{r.action_kind ?? r.action}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.level ? `L${r.level}` : "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.approver_name || nameFor(profiles, r.actor_id) || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.old_status ?? "—"} → {r.new_status ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.comment || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2">
                      <Link to="/nfa/$id" params={{ id: r.nfa_id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {paged.map((r) => {
            const n = nfas[r.nfa_id];
            return (
              <Link key={r.id} to="/nfa/$id" params={{ id: r.nfa_id }} className="block p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={kindTone(r.action_kind)}>{r.action_kind ?? r.action}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm font-medium">{n?.enfa_number ?? r.nfa_id.slice(0, 8)} {r.level ? <span className="ml-1 text-xs text-muted-foreground">· L{r.level}</span> : null}</div>
                <div className="truncate text-xs text-muted-foreground">{n?.subject ?? ""}</div>
                <div className="mt-1 text-xs text-muted-foreground">By {r.approver_name || nameFor(profiles, r.actor_id) || "—"}</div>
                {r.comment && <div className="mt-1 text-xs">{r.comment}</div>}
              </Link>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        )}
        {!loading && paged.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="h-6 w-6" />
            <div>No audit entries match your filters.</div>
          </div>
        )}

        {filtered.length > pageSize && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
            <div className="text-muted-foreground">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
