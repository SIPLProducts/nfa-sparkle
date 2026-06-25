import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, STATUS_TONE, APPROVER_TONE, type NfaRow, type ApproverRow } from "@/lib/nfa-types";
import { nfaTypeName } from "@/lib/sap/master";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { PlusCircle, Search, FileText } from "lucide-react";

export const Route = createFileRoute("/_authed/nfa/my")({
  component: MyNfas,
});

function MyNfas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NfaRow[]>([]);
  const [appr, setAppr] = useState<Record<string, ApproverRow[]>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => r.enfa_number.toLowerCase().includes(s) || r.subject.toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="My NFAs"
        subtitle="NFAs you have initiated — track status across the approver chain."
        actions={
          <>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ENFA #, subject…" className="h-9 w-full pl-9 sm:w-64" />
            </div>
            <Link to="/nfa/new" className="shrink-0"><Button size="sm" className="gap-1.5"><PlusCircle className="h-4 w-4" /> New NFA</Button></Link>
          </>
        }
      />

      {/* Mobile card list */}
      <div className="space-y-2.5 md:hidden">
        {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
            <div className="text-sm font-medium">No NFAs found</div>
            <div className="text-xs text-muted-foreground">{q ? "Try a different search." : "Create your first NFA to get started."}</div>
          </div>
        )}
        {filtered.map((r) => {
          const chain = appr[r.id] ?? [];
          const current = chain.find((c) => c.level === r.current_level);
          return (
            <Link key={r.id} to="/nfa/$id" params={{ id: r.id }} className="block rounded-lg border border-border bg-card p-3 shadow-sm active:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-accent">{r.enfa_number}</span>
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{r.subject}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {nfaTypeName(r.nfa_type)} · {r.plant ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
              </div>
              {current && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
                  <span className="text-muted-foreground">L{current.level} · <span className="text-foreground">{nameFor(profiles, current.approver_id)}</span></span>
                  <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + APPROVER_TONE[current.status]}>{current.status}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>ENFA Number</Th><Th>Status</Th><Th>Plant</Th><Th>NFA Type</Th><Th>Subject</Th><Th>Created</Th>
                {[1,2,3,4,5,6].map((l) => (<Th key={`s${l}`}>{`L${l}`}</Th>))}
                <Th> </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={20}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={20} className="px-4 py-12 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <div className="text-sm font-medium">No NFAs found</div>
                  <div className="text-xs text-muted-foreground">{q ? "Try a different search." : "Create your first NFA to get started."}</div>
                </td></tr>
              )}
              {filtered.map((r) => {
                const chain = appr[r.id] ?? [];
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <Td><Link to="/nfa/$id" params={{ id: r.id }} className="font-mono text-xs font-medium text-accent hover:underline">{r.enfa_number}</Link></Td>
                    <Td><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</span></Td>
                    <Td className="text-muted-foreground">{r.plant ? `${r.plant} · ${r.plant_name ?? ""}` : "—"}</Td>
                    <Td>{nfaTypeName(r.nfa_type)}</Td>
                    <Td className="max-w-[280px] truncate">{r.subject}</Td>
                    <Td className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</Td>
                    {[1,2,3,4,5,6].map((l) => {
                      const a = chain.find((c) => c.level === l);
                      return (
                        <Td key={`s${l}`}>
                          {a ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate text-xs">{nameFor(profiles, a.approver_id)}</span>
                              <span className={"inline-flex w-fit items-center rounded-full px-1.5 py-px text-[10px] font-medium " + APPROVER_TONE[a.status]}>{a.status}</span>
                            </div>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </Td>
                      );
                    })}
                    <Td><Link to="/nfa/$id" params={{ id: r.id }}><Button variant="outline" size="sm">Open</Button></Link></Td>
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

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 whitespace-nowrap font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 whitespace-nowrap " + className}>{children}</td>;
}