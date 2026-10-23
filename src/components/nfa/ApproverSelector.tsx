import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApproverChains, filterApproverChains } from "@/lib/sap-approval-flow";
import type { parseApprovalChains } from "@/lib/sap/master";
import { resolveApprovalUserEmails } from "@/lib/approval-chain.functions";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { MIN_CREATE_APPROVERS } from "@/lib/sap-api-constants";
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
  const predefined = check === "X";

  // Both modes call the Dynamic Approvals (get_detail) API with check, plant, NFA type and function.
  useEffect(() => {
    setChains(null); setFallback(null); setError(""); setSapMessage("");
    if (!plant) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = await fetchSapApproverChains({ plant, check: predefined ? "X" : " ", nfaType, functionName }, token, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setChains(res.chains ?? []); setSapMessage(res.message);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Approval chain is unavailable");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [plant, nfaType, functionName, predefined]);

  // Predefined narrows to the chosen chain; Dynamic shows SAP's reply as-is.
  const visible = useMemo(
    () => (chains ? (predefined ? filterApproverChains(chains, { plant, nfaType, functionName }) : chains) : []),
    [chains, plant, nfaType, functionName, predefined],
  );
  const showGroup = !predefined || visible.length > 1;
  const levels = useMemo<EnfaDocumentApprover[]>(() => {
    return visible.flatMap((c) => c.levels.map((l) => ({
      level: l.level, role: l.designation, userId: l.userId, name: "", status: "", actedDate: "", actedTime: "",
      group: showGroup ? `${c.funct}${c.extraTxt ? ` / ${c.extraTxt}` : ""}` : "",
    }))).filter((a) => a.userId);
  }, [visible, showGroup]);

  const levelKey = `${check}::` + levels.map((a) => `${a.userId}|${a.level}|${(a as { group?: string }).group ?? ""}`).join(",");
  useEffect(() => {
    setChecked(new Set(predefined && visible.length <= 1 ? levels.map((_, i) => i) : []));
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
    return <p className="text-sm text-muted-foreground">{sapMessage || "No approvers returned by SAP."}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{predefined ? "Predefined Approvers" : "Dynamic Approvers"}</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              {showGroup && <th className="px-3 py-2">NFA Type / Function</th>}
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
                {showGroup && <td className="px-3 py-2 text-muted-foreground">{(a as { group?: string }).group}</td>}
                <td className="px-3 py-2">{a.level}</td>
                <td className="px-3 py-2">{a.role || "—"}</td>
                <td className="px-3 py-2 font-medium">{a.userId}</td>
                <td className="px-3 py-2 text-muted-foreground">{emails[a.userId] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.length >= MIN_CREATE_APPROVERS ? (
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
        <p className="text-sm text-destructive">Please select at least {MIN_CREATE_APPROVERS} approvers.</p>
      )}
    </div>
  );
}
