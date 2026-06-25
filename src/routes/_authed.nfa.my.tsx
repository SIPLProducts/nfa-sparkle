import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, type NfaRow, type ApproverRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authed/nfa/my")({
  component: MyNfas,
});

function MyNfas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NfaRow[]>([]);
  const [appr, setAppr] = useState<Record<string, ApproverRow[]>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: nfas } = await supabase.from("nfa").select("*").eq("initiator_id", user.id).order("created_at", { ascending: false });
      setRows((nfas as NfaRow[]) ?? []);
      const ids = (nfas ?? []).map((n) => n.id);
      if (ids.length) {
        const { data: as } = await supabase.from("nfa_approver").select("*").in("nfa_id", ids).order("level");
        const m: Record<string, ApproverRow[]> = {};
        for (const r of (as as ApproverRow[]) ?? []) (m[r.nfa_id] ||= []).push(r);
        setAppr(m);
        setProfiles(await fetchProfilesMap(((as as ApproverRow[]) ?? []).map((a) => a.approver_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">My NFAs</h2>
        <Link to="/nfa/new"><Button size="sm" className="bg-yellow-300 text-slate-900 hover:bg-yellow-400">+ New NFA</Button></Link>
      </div>
      <Card className="overflow-x-auto border-slate-300 bg-white p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-200 text-left text-xs uppercase text-slate-700">
            <tr>
              <Th>ENFA Number</Th><Th>Status</Th><Th>Plant</Th><Th>Plant Name</Th>
              <Th>NFA Type</Th><Th>Creation Date</Th>
              {[1,2,3,4,5,6].map((l) => (<><Th key={`a${l}`}>{`Approver${l}`}</Th><Th key={`s${l}`}>{`Status${l}`}</Th></>))}
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && <tr><td className="p-3 text-slate-500" colSpan={20}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={20}>No NFAs yet.</td></tr>}
            {rows.map((r) => {
              const chain = appr[r.id] ?? [];
              return (
                <tr key={r.id} className="hover:bg-sky-50">
                  <Td><Link to="/nfa/$id" params={{ id: r.id }} className="font-medium text-sky-700 hover:underline">{r.enfa_number}</Link></Td>
                  <Td><Badge variant="outline">{STATUS_LABEL[r.status]}</Badge></Td>
                  <Td>{r.plant}</Td><Td>{r.plant_name}</Td>
                  <Td>{nfaTypeName(r.nfa_type)}</Td>
                  <Td>{new Date(r.created_at).toLocaleDateString()}</Td>
                  {[1,2,3,4,5,6].map((l) => {
                    const a = chain.find((c) => c.level === l);
                    return (<><Td key={`a${l}`}>{a ? nameFor(profiles, a.approver_id) : ""}</Td><Td key={`s${l}`}>{a ? a.status : ""}</Td></>);
                  })}
                  <Td><Link to="/nfa/$id" params={{ id: r.id }}><Button variant="link" size="sm">Open</Button></Link></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) { return <th className="px-3 py-2 whitespace-nowrap">{children}</th>; }
function Td({ children }: { children?: React.ReactNode }) { return <td className="px-3 py-2 whitespace-nowrap">{children}</td>; }