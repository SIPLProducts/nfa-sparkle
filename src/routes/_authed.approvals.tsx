import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type ApproverRow, type NfaRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Inbox, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authed/approvals")({
  component: ApprovalsInbox,
});

function ApprovalsInbox() {
  const { user } = useAuth();
  const [rows, setRows] = useState<{ nfa: NfaRow; ap: ApproverRow }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: aps } = await supabase.from("nfa_approver").select("*").eq("approver_id", user.id);
      const list = (aps as ApproverRow[]) ?? [];
      if (!list.length) { setRows([]); setLoading(false); return; }
      const nfaIds = list.map((l) => l.nfa_id);
      const { data: nfas } = await supabase.from("nfa").select("*").in("id", nfaIds);
      const nMap = new Map(((nfas as NfaRow[]) ?? []).map((n) => [n.id, n]));
      const joined = list
        .map((ap) => ({ ap, nfa: nMap.get(ap.nfa_id)! }))
        .filter((r) => r.nfa && r.nfa.status === "in_process" && r.nfa.current_level === r.ap.level && r.ap.status === "pending");
      setRows(joined);
      setProfiles(await fetchProfilesMap(joined.map((r) => r.nfa.initiator_id)));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Approvals Inbox"
        subtitle="Items currently waiting for your decision."
        actions={
          <div className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">
            <Inbox className="h-3.5 w-3.5" />
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </div>
        }
      />

      {/* Mobile card list */}
      <div className="space-y-2.5 md:hidden">
        {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/70" />
            <div className="text-sm font-medium">You're all caught up</div>
            <div className="text-xs text-muted-foreground">No items are currently waiting on your decision.</div>
          </div>
        )}
        {rows.map(({ nfa, ap }) => (
          <Link key={ap.id} to="/nfa/$id" params={{ id: nfa.id }} className="block rounded-lg border border-border bg-card p-3 shadow-sm active:bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold text-accent">{nfa.enfa_number}</span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">Level {ap.level}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{nfa.subject}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {nfaTypeName(nfa.nfa_type)} · {nfa.plant ?? "—"}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              <span>From <span className="text-foreground">{nameFor(profiles, nfa.initiator_id)}</span></span>
              <span>{new Date(nfa.created_at).toLocaleDateString()}</span>
            </div>
            <div className="mt-2"><Button size="sm" className="w-full">Review</Button></div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">ENFA #</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 font-medium">Plant</th>
                <th className="px-3 py-2.5 font-medium">NFA Type</th>
                <th className="px-3 py-2.5 font-medium">Initiator</th>
                <th className="px-3 py-2.5 font-medium">Submitted</th>
                <th className="px-3 py-2.5 font-medium">Level</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={8} className="px-4 py-6 text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500/70" />
                  <div className="text-sm font-medium">You're all caught up</div>
                  <div className="text-xs text-muted-foreground">No items are currently waiting on your decision.</div>
                </td></tr>
              )}
              {rows.map(({ nfa, ap }) => (
                <tr key={ap.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-accent">
                    <Link to="/nfa/$id" params={{ id: nfa.id }} className="hover:underline">{nfa.enfa_number}</Link>
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2.5">{nfa.subject}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{nfa.plant ? `${nfa.plant} · ${nfa.plant_name ?? ""}` : "—"}</td>
                  <td className="px-3 py-2.5">{nfaTypeName(nfa.nfa_type)}</td>
                  <td className="px-3 py-2.5">{nameFor(profiles, nfa.initiator_id)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{new Date(nfa.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
                      Level {ap.level}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm">Review</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}