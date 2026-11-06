import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApproverChains, fetchSapDynamicApprovers, filterApproverChains } from "@/lib/sap-approval-flow";
import type { parseApprovalChains } from "@/lib/sap/master";
import { resolveApprovalUserEmails, resolveApprovalUserDetails } from "@/lib/approval-chain.functions";
import { withApproverNames } from "@/lib/approver-names";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { MIN_CREATE_APPROVERS } from "@/lib/sap-api-constants";
import { Checkbox } from "@/components/ui/checkbox";
import { orderSelected, toggleOrdered } from "@/lib/approver-order";

interface Props {
  plant: string;
  nfaType: string;
  functionName: string;
  /** SAP approver-mode flag: "X" predefined, "" dynamic. */
  check?: string;
  /** Every plant code from Plant F4; used only by Dynamic mode. */
  plants?: string[];
  onChange?: (selected: EnfaDocumentApprover[]) => void;
}

/** Lists configured Approval Chain approvers and lets the initiator pick which ones apply. */
export function ApproverSelector({ plant, nfaType, functionName, check = "", plants = [], onChange }: Props) {
  const resolveEmails = useServerFn(resolveApprovalUserEmails);
  const [chains, setChains] = useState<ReturnType<typeof parseApprovalChains> | null>(null);
  const [fallback, setFallback] = useState<EnfaDocumentApprover[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const resolveDetails = useServerFn(resolveApprovalUserDetails);
  const [details, setDetails] = useState<Record<string, { name: string; department: string }>>({});
  const [checked, setChecked] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sapMessage, setSapMessage] = useState("");
  const predefined = check === "X";
  const [attempt, setAttempt] = useState(0);
  const plantsKey = plants.join(",");

  // Both modes call the Dynamic Approvals (get_detail) API with check, plant, NFA type and function.
  useEffect(() => {
    setChains(null); setFallback(null); setError(""); setSapMessage("");
    if (predefined ? !plant : !plantsKey) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = predefined
          ? await fetchSapApproverChains({ plant, check: "X", nfaType, functionName }, token, ctrl.signal)
          : await fetchSapDynamicApprovers(plantsKey.split(","), token, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setChains(res.chains ?? []); setSapMessage(res.message);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          const msg = e instanceof Error ? e.message : "Approval chain is unavailable";
          setError(/failed to fetch|networkerror|load failed/i.test(msg) ? "Could not reach the portal, please try again." : msg);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [plant, nfaType, functionName, predefined, plantsKey, attempt]);

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
    setChecked(predefined && visible.length <= 1 ? levels.map((_, i) => i) : []);
    const ids = [...new Set(levels.map((a) => a.userId))];
    if (ids.length) resolveEmails({ data: { userIds: ids } }).then(setEmails).catch(() => {});
    if (ids.length) resolveDetails({ data: { userIds: ids } }).then(setDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  // Selection order (not list order) decides each approver's level.
  // Attach each approver's portal name so the create payload's name slots are filled.
  const selected = useMemo(() => withApproverNames(orderSelected(levels, checked), details), [levels, checked, details]);
  useEffect(() => { onChange?.(selected); }, [selected, onChange]);

  function toggle(i: number) {
    setChecked((prev) => toggleOrdered(prev, i));
  }

  if (predefined ? !plant : !plantsKey) {
    return <p className="text-sm text-muted-foreground">{predefined ? "Select a Plant to see the approvers." : "Select a Company to load its plants and approvers."}</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading approvers…</p>;
  if (error) return (
    <p className="text-sm text-muted-foreground">
      {error}{" "}
      <button type="button" className="font-medium text-primary underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
    </p>
  );
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
              <th className="px-3 py-2">Department Name</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Approver Name</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((a, i) => (
              <tr key={`${a.userId}-${i}`} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {!(predefined && visible.length <= 1) && <Checkbox checked={checked.includes(i)} onCheckedChange={() => toggle(i)} aria-label={`Select ${details[a.userId]?.name || a.userId}`} />}
                    {checked.includes(i) && <span className="text-xs font-semibold text-primary">#{checked.indexOf(i) + 1}</span>}
                  </div>
                </td>
                <td className="px-3 py-2">{details[a.userId]?.department || "—"}</td>
                <td className="px-3 py-2">{a.role || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.userId || "—"}</td>
                <td className="px-3 py-2">{details[a.userId]?.name || "—"}</td>
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
                Level {a.level}: {details[a.userId]?.name || "—"}{a.role ? ` (${a.role})` : ""}
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
