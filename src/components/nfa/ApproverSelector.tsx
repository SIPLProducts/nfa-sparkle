import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApproverDetail } from "@/lib/sap-approval-flow";
import { resolveApprovalUserEmails } from "@/lib/approval-chain.functions";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  plant: string;
  nfaType: string;
  functionName: string;
  /** SAP approver-mode flag: "X" predefined, "" dynamic. */
  check?: string;
  onChange?: (selected: EnfaDocumentApprover[]) => void;
}

/** Lists configured Approval Chain approvers and lets the initiator pick which ones apply. */
export function ApproverSelector({ plant, nfaType, functionName, check = "", onChange }: Props) {
  const resolveEmails = useServerFn(resolveApprovalUserEmails);
  const [levels, setLevels] = useState<EnfaDocumentApprover[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLevels([]); setChecked(new Set()); setError("");
    if (!plant || !nfaType || !functionName) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = await fetchSapApproverDetail({ plant, nfaType, functionName, check }, token, ctrl.signal);
        if (ctrl.signal.aborted) return;
        const list = res.approvers.filter((a) => a.userId);
        setLevels(list);
        setChecked(new Set(list.map((_, i) => i)));
        const ids = [...new Set(list.map((a) => a.userId))];
        if (ids.length) {
          resolveEmails({ data: { userIds: ids } }).then((m) => !ctrl.signal.aborted && setEmails(m)).catch(() => {});
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Approval chain is unavailable");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [plant, nfaType, functionName, check, resolveEmails]);

  const selected = useMemo(
    () => levels.filter((_, i) => checked.has(i)).map((a, i) => ({ ...a, level: i + 1 })),
    [levels, checked],
  );
  useEffect(() => { onChange?.(selected); }, [selected, onChange]);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  if (!plant || !nfaType || !functionName) {
    return <p className="text-sm text-muted-foreground">Select Project, NFA Type and Function to see the approvers.</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading approvers…</p>;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!levels.length) return <p className="text-sm text-muted-foreground">No approval chain configured.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Email ID</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((a, i) => (
              <tr key={`${a.userId}-${i}`} className="border-t">
                <td className="px-3 py-2">
                  <Checkbox checked={checked.has(i)} onCheckedChange={() => toggle(i)} aria-label={`Select ${a.userId}`} />
                </td>
                <td className="px-3 py-2">{a.level}</td>
                <td className="px-3 py-2">{a.role || "—"}</td>
                <td className="px-3 py-2 font-medium">{a.userId}</td>
                <td className="px-3 py-2 text-muted-foreground">{emails[a.userId] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.length ? (
        <div className="text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Selected sequence</p>
          <ol className="flex flex-wrap gap-2">
            {selected.map((a) => (
              <li key={`${a.userId}-${a.level}`} className="rounded-md border bg-muted/40 px-2 py-1">
                Level {a.level}: {a.userId}{a.role ? ` (${a.role})` : ""}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-destructive">Please select at least one approver.</p>
      )}
    </div>
  );
}
