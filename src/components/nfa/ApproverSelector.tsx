import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApprovalChain } from "@/lib/sap-approval-flow";
import { resolveApprovalUserEmails } from "@/lib/approval-chain.functions";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  plant: string;
  nfaType: string;
  functionName: string;
  onChange?: (selected: EnfaDocumentApprover[]) => void;
}

/** Lists configured Approval Chain approvers and lets the initiator pick which ones apply. */
export function ApproverSelector({ plant, nfaType, functionName, onChange }: Props) {
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
        const res = await fetchSapApprovalChain({ plant, nfaType, functionName }, token, ctrl.signal);
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
  }, [plant, nfaType, functionName, resolveEmails]);

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
    <div className="min-w-0 space-y-5">
      <div className="max-w-full overflow-x-auto border-y border-border">
        <table className="w-full min-w-[460px] text-sm">
          <thead className="bg-muted/60 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3" />
              <th className="px-3 py-3">Level</th>
              <th className="px-3 py-3">Designation</th>
              <th className="px-3 py-3">User ID</th>
              <th className="px-3 py-3">Email ID</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((a, i) => (
              <tr key={`${a.userId}-${i}`} className={"border-t border-border transition-colors hover:bg-muted/40 " + (checked.has(i) ? "bg-primary/5" : "bg-card")}>
                <td className="px-3 py-3">
                  <Checkbox checked={checked.has(i)} onCheckedChange={() => toggle(i)} aria-label={`Select ${a.userId}`} />
                </td>
                <td className="px-3 py-3">{a.level}</td>
                <td className="px-3 py-3">{a.role || "—"}</td>
                <td className="px-3 py-3 font-medium">{a.userId}</td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{emails[a.userId] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.length ? (
        <div className="text-sm">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">Selected sequence</p>
          <ol className="space-y-2 border-l-2 border-primary/20 pl-3">
            {selected.map((a) => (
              <li key={`${a.userId}-${a.level}`} className="break-words py-1 text-xs leading-relaxed text-foreground">
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
