import { useCallback, useEffect, useState } from "react";
import { GitBranch, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { parseApprovalChains, type SapApprovalChain } from "@/lib/sap/master";

export function ApprovalChainTab() {
  const [approver, setApprover] = useState("");
  const [chains, setChains] = useState<SapApprovalChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (approverValue: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/public/sap-approval-chain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ approver: approverValue }),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const p = parsed as Record<string, unknown> | null;
        const detail =
          (p && typeof p === "object" && (p["error"] ?? p["MESSAGE"] ?? p["message"])) ||
          (text ? text.slice(0, 300) : "") ||
          `SAP responded with status ${res.status}`;
        setChains([]);
        setError(`SAP: ${String(detail)}`);
        return;
      }

      const list = parseApprovalChains(parsed);
      setChains(list);
      if (!list.length) {
        const p = parsed as Record<string, unknown> | null;
        const msg = p && typeof p === "object" ? (p["message"] ?? p["MESSAGE"]) : null;
        setNotice(msg ? String(msg) : "No approval chains returned by SAP.");
      }
    } catch {
      setChains([]);
      setError("Could not reach the SAP approval chain service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Approval chains configured in SAP. Each level shows the designation and the approver&apos;s User ID.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(approver);
              }}
              placeholder="Approver (optional)"
              className="h-9 w-52 pl-8"
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void load(approver)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load(approver)}>
            Retry
          </Button>
        </div>
      ) : chains.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{notice || "No approval chains returned by SAP."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load(approver)}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {chains.map((c, idx) => (
            <div key={`${c.pspnr}-${c.funct}-${idx}`} className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{c.funct || "—"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.extraTxt ? <span className="mr-2">{c.extraTxt}</span> : null}
                    {c.pspnr ? <span className="mr-2">Project {c.pspnr}</span> : null}
                    {c.begda || c.endda ? (
                      <span>
                        Valid {c.begda || "—"} → {c.endda || "—"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Badge variant="secondary" className="font-normal">
                  {c.levels.length} level{c.levels.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Level</th>
                      <th className="px-4 py-2.5 font-medium">Designation</th>
                      <th className="px-4 py-2.5 font-medium">User ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {c.levels.map((l) => (
                      <tr key={l.level}>
                        <td className="px-4 py-2.5 font-medium">L{l.level}</td>
                        <td className="px-4 py-2.5">{l.designation || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{l.userId || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
