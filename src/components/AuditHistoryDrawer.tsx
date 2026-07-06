import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { History, Search, Loader2, Inbox, ExternalLink } from "lucide-react";

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

const kindTone = (k: string | null) => {
  switch (k) {
    case "approve": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "reject": return "bg-rose-50 text-rose-700 border-rose-200";
    case "clarify": return "bg-amber-50 text-amber-700 border-amber-200";
    case "back": return "bg-sky-50 text-sky-700 border-sky-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

export function AuditHistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nfas, setNfas] = useState<Record<string, NfaLite>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [q, setQ] = useState("");
  const [fKind, setFKind] = useState("all");

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      setLoading(true);
      const { data: au } = await supabase
        .from("nfa_audit")
        .select("*")
        .order("at", { ascending: false })
        .limit(300);
      const list = (au as AuditRow[]) ?? [];
      setRows(list);
      const nfaIds = Array.from(new Set(list.map((r) => r.nfa_id)));
      if (nfaIds.length) {
        const { data: ns } = await supabase
          .from("nfa").select("id,enfa_number,subject").in("id", nfaIds);
        const map: Record<string, NfaLite> = {};
        for (const n of (ns ?? []) as NfaLite[]) map[n.id] = n;
        setNfas(map);
      }
      const actorIds = list.map((r) => r.actor_id).filter((x): x is string => Boolean(x));
      setProfiles(await fetchProfilesMap(actorIds));
      setLoading(false);
      setLoaded(true);
    })();
  }, [open, loaded]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (fKind !== "all" && (r.action_kind ?? "") !== fKind) return false;
    if (q) {
      const hay = [
        r.action, r.comment, r.approver_name,
        nfas[r.nfa_id]?.enfa_number, nfas[r.nfa_id]?.subject,
        nameFor(profiles, r.actor_id),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, fKind, nfas, profiles]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="View audit history" title="Audit history">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Audit History
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Recent activity across NFAs you can access.</p>
        </SheetHeader>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8 h-9" />
          </div>
          <Select value={fKind} onValueChange={setFKind}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="clarify">Clarification</SelectItem>
              <SelectItem value="back">Back</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
              <Inbox className="h-6 w-6" /> No entries.
            </div>
          )}
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const n = nfas[r.nfa_id];
              return (
                <li key={r.id} className="p-3 hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={kindTone(r.action_kind)}>
                      {r.action_kind ?? r.action}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="text-sm font-medium">{n?.enfa_number ?? r.nfa_id.slice(0, 8)}</div>
                    {r.level ? <span className="text-xs text-muted-foreground">· L{r.level}</span> : null}
                  </div>
                  {n?.subject && <div className="truncate text-xs text-muted-foreground">{n.subject}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    By {r.approver_name || nameFor(profiles, r.actor_id) || "—"}
                    {" · "}{r.old_status ?? "—"} → {r.new_status ?? "—"}
                  </div>
                  {r.comment && <div className="mt-1 text-xs">{r.comment}</div>}
                  <div className="mt-2">
                    <Link
                      to="/nfa/$id"
                      params={{ id: r.nfa_id }}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open NFA <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}