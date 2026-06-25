import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type ApproverRow, type NfaRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <h2 className="mb-3 text-lg font-semibold text-slate-700">Pending Approvals</h2>
      <Card className="overflow-x-auto border-slate-300 p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-200 text-left text-xs uppercase text-slate-700">
            <tr><th className="p-2">ENFA No</th><th className="p-2">Plant</th><th className="p-2">Plant Name</th><th className="p-2">NFA Type</th><th className="p-2">Date</th><th className="p-2">Subject</th><th className="p-2">Initiator</th><th className="p-2">Level</th><th className="p-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && <tr><td colSpan={9} className="p-3 text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="p-3 text-slate-500">Nothing waiting on you.</td></tr>}
            {rows.map(({ nfa, ap }) => (
              <tr key={ap.id} className="hover:bg-sky-50">
                <td className="p-2 font-medium text-sky-700"><Link to="/nfa/$id" params={{ id: nfa.id }}>{nfa.enfa_number}</Link></td>
                <td className="p-2">{nfa.plant}</td>
                <td className="p-2">{nfa.plant_name}</td>
                <td className="p-2">{nfaTypeName(nfa.nfa_type)}</td>
                <td className="p-2">{new Date(nfa.created_at).toLocaleDateString()}</td>
                <td className="p-2">{nfa.subject}</td>
                <td className="p-2">{nameFor(profiles, nfa.initiator_id)}</td>
                <td className="p-2"><Badge variant="outline">L{ap.level}</Badge></td>
                <td className="p-2"><Link to="/nfa/$id" params={{ id: nfa.id }}><Button size="sm" className="bg-yellow-300 text-slate-900 hover:bg-yellow-400">Open</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}