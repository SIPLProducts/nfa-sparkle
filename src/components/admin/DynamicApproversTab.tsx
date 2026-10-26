import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { resolveApprovalUserEmails } from "@/lib/approval-chain.functions";
import type { DynamicApproverRecord } from "@/lib/sap-dynamic-approvers";

export function DynamicApproversTab() {
  const [nfaNo, setNfaNo] = useState("");
  const [records, setRecords] = useState<DynamicApproverRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/public/sap-dynamic-approvers", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nfaNo: value.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      const list: DynamicApproverRecord[] = json.records ?? [];
      setRecords(list);
      if (!list.length) setNotice(json.message || "SAP returned no dynamic approvers.");
      const ids = [...new Set(list.flatMap((r) => r.levels.map((l) => l.userId)).filter(Boolean))];
      if (ids.length) {
        resolveApprovalUserEmails({ data: { userIds: ids } }).then((m) => setEmails((c) => ({ ...c, ...m }))).catch(() => {});
      }
    } catch (e) {
      setRecords([]);
      setNotice(e instanceof Error ? e.message : "Unable to load dynamic approvers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Dynamic approvers saved in SAP for each NFA (view only).</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(nfaNo); }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={nfaNo} onChange={(e) => setNfaNo(e.target.value)} placeholder="NFA number (blank = all)" className="w-64 pl-9" />
          </div>
          <Button type="submit" variant="outline" size="icon" disabled={loading} aria-label="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {loading && !records.length ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading dynamic approvers…</div>
      ) : notice ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{notice}</div>
      ) : null}

      {records.map((r, i) => (
        <div key={`${r.nfaNo}-${i}`} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> NFA {r.nfaNo || "—"}</div>
            <Badge variant="secondary">{r.levels.length} levels</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3 text-left">Level</th><th className="px-5 py-3 text-left">Designation</th><th className="px-5 py-3 text-left">User ID</th><th className="px-5 py-3 text-left">Email ID</th></tr>
              </thead>
              <tbody>
                {r.levels.map((l) => (
                  <tr key={l.level} className="border-t">
                    <td className="px-5 py-3 font-semibold">L{l.level}</td>
                    <td className="px-5 py-3">{l.designation || "—"}</td>
                    <td className="px-5 py-3 font-mono">{l.userId || "—"}</td>
                    <td className="px-5 py-3">{emails[l.userId] || emails[l.userId.toLowerCase()] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
