import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApprovalChain, fetchSapApproverChains, filterApproverChains } from "@/lib/sap-approval-flow";
import type { parseApprovalChains } from "@/lib/sap/master";
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
  const [chains, setChains] = useState<ReturnType<typeof parseApprovalChains> | null>(null);
  const [fallback, setFallback] = useState<EnfaDocumentApprover[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sapMessage, setSapMessage] = useState("");

  // Load from SAP as soon as Plant is chosen (and again when approver mode changes).
  useEffect(() => {
    setChains(null); setFallback(null); setError(""); setSapMessage("");
    if (!plant) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = await fetchSapApproverChains({ plant, check }, token, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (res.chains) { setChains(res.chains); setSapMessage(res.message); }
        else { setChains([]); setFallback([]); }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Approval chain is unavailable");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [plant, check]);

  // Fallback to the configured Approval Chain API when the get_detail API is unavailable.
  useEffect(() => {
    if (!fallback || fallback.length || !plant || !nfaType || !functionName) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetchSapApprovalChain({ plant, nfaType, functionName }, data.session?.access_token ?? "", ctrl.signal);
        if (!ctrl.signal.aborted && res.approvers.length) setFallback(res.approvers);
      } catch { /* keep empty */ }
    })();
    return () => ctrl.abort();
  }, [fallback, plant, nfaType, functionName]);

  const visible = useMemo(
    () => (chains ? filterApproverChains(chains, { plant, nfaType, functionName }) : []),
    [chains, plant, nfaType, functionName],
  );
  const levels = useMemo<EnfaDocumentApprover[]>(() => {
    if (fallback && fallback.length) return fallback.filter((a) => a.userId);
    return visible.flatMap((c) => c.levels.map((l) => ({
      level: l.level, role: l.designation, userId: l.userId, name: "", status: "", actedDate: "", actedTime: "",
      group: visible.length > 1 ? `${c.funct}${c.extraTxt ? ` / ${c.extraTxt}` : ""}` : "",
    }))).filter((a) => a.userId);
  }, [visible, fallback]);

  const levelKey = levels.map((a) => `${a.userId}|${a.level}|${(a as { group?: string }).group ?? ""}`).join(",");
  useEffect(() => {
    setChecked(new Set(visible.length > 1 ? [] : levels.map((_, i) => i)));
    const ids = [...new Set(levels.map((a) => a.userId))];
    if (ids.length) resolveEmails({ data: { userIds: ids } }).then(setEmails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

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

  if (!plant) {
    return <p className="text-sm text-muted-foreground">Select a Plant to see the approvers.</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading approvers…</p>;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!levels.length) {
    if (fallback && (!nfaType || !functionName)) return <p className="text-sm text-muted-foreground">Select NFA Type and Function to see the approvers.</p>;
    return <p className="text-sm text-muted-foreground">{sapMessage || "No approvers returned by SAP."}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              {visible.length > 1 && <th className="px-3 py-2">NFA Type / Function</th>}
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
                {visible.length > 1 && <td className="px-3 py-2 text-muted-foreground">{(a as { group?: string }).group}</td>}
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
