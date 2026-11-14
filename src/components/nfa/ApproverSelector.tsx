import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchSapApproverChains, filterApproverChains } from "@/lib/sap-approval-flow";
import type { parseApprovalChains } from "@/lib/sap/master";
import { resolveApprovalUserEmails, resolveApprovalUserDetails } from "@/lib/approval-chain.functions";
import { listSeriesApprovers, listApproverSeriesOptions } from "@/lib/series-approvers.functions";
import { withApproverNames } from "@/lib/approver-names";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { MIN_CREATE_APPROVERS } from "@/lib/sap-api-constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { orderSelected, toggleOrdered } from "@/lib/approver-order";

interface Props {
  plant: string;
  nfaType: string;
  functionName: string;
  /** SAP approver-mode flag: "X" predefined, "" dynamic. */
  check?: string;
  /** Every plant code from Plant F4; used only by Dynamic mode. */
  plants?: string[];
  /** Selected company; Budgeted mode lists User Management approvers in its Series. */
  company?: string;
  onChange?: (selected: EnfaDocumentApprover[]) => void;
}

/** Lists configured Approval Chain approvers and lets the initiator pick which ones apply. */
export function ApproverSelector({ plant, nfaType, functionName, check = "", plants = [], company = "", onChange }: Props) {
  const resolveEmails = useServerFn(resolveApprovalUserEmails);
  const [chains, setChains] = useState<ReturnType<typeof parseApprovalChains> | null>(null);
  const [fallback, setFallback] = useState<EnfaDocumentApprover[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const resolveDetails = useServerFn(resolveApprovalUserDetails);
  const loadSeriesApprovers = useServerFn(listSeriesApprovers);
  const [details, setDetails] = useState<Record<string, { name: string; department: string }>>({});
  const [checked, setChecked] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sapMessage, setSapMessage] = useState("");
  const predefined = check === "X";
  const [attempt, setAttempt] = useState(0);
  const plantsKey = plants.join(",");
  const loadSeriesOptions = useServerFn(listApproverSeriesOptions);
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [seriesFilter, setSeriesFilter] = useState("");
  // Budgeted: every user fetched so far, so ticks survive switching Series.
  const [pool, setPool] = useState<{ userId: string; designation: string; series: string }[]>([]);

  useEffect(() => {
    if (predefined) return;
    loadSeriesOptions().then((r) => {
      setSeriesOptions(r.series);
      setSeriesFilter((cur) => cur || r.mine || r.series[0] || "");
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predefined]);

  // New Company/Plant starts a fresh Budgeted selection.
  useEffect(() => { setPool([]); setChecked([]); }, [company, plant, predefined]);

  // Both modes call the Dynamic Approvals (get_detail) API with check, plant, NFA type and function.
  useEffect(() => {
    if (predefined) setChains(null);
    setFallback(null); setError(""); setSapMessage("");
    if (predefined ? !plant : !(company && plant && seriesFilter)) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        if (!predefined) {
          // Budgeted: approvers come from User Management, filtered by the company's Series.
          const r = await loadSeriesApprovers({ data: { company, plant, series: seriesFilter } });
          if (ctrl.signal.aborted) return;
          setPool((prev) => {
            const have = new Set(prev.map((u) => u.userId));
            return [...prev, ...r.users.filter((u) => !have.has(u.userId)).map((u) => ({ userId: u.userId, designation: u.designation, series: r.series ?? "" }))];
          });
          setSapMessage("No approvers are assigned to this Series.");
          return;
        }
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = await fetchSapApproverChains({ plant, check: "X", nfaType, functionName }, token, ctrl.signal);
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
  }, [plant, nfaType, functionName, predefined, plantsKey, company, attempt, seriesFilter]);

  // Predefined narrows to the chosen chain; Dynamic shows SAP's reply as-is.
  const visible = useMemo(
    () => (chains ? (predefined ? filterApproverChains(chains, { plant, nfaType, functionName }) : chains) : []),
    [chains, plant, nfaType, functionName, predefined],
  );
  const showGroup = predefined && visible.length > 1;
  const levels = useMemo<EnfaDocumentApprover[]>(() => {
    if (!predefined) return pool.map((u, i) => ({ level: i + 1, role: u.designation, userId: u.userId, name: "", status: "", actedDate: "", actedTime: "", group: u.series }));
    return visible.flatMap((c) => c.levels.map((l) => ({
      level: l.level, role: l.designation, userId: l.userId, name: "", status: "", actedDate: "", actedTime: "",
      group: showGroup ? `${c.funct}${c.extraTxt ? ` / ${c.extraTxt}` : ""}` : "",
    }))).filter((a) => a.userId);
  }, [visible, showGroup, predefined, pool]);

  const levelKey = `${check}::` + levels.map((a) => `${a.userId}|${a.level}|${(a as { group?: string }).group ?? ""}`).join(",");
  useEffect(() => {
    if (predefined) setChecked(visible.length <= 1 ? levels.map((_, i) => i) : []);
    const ids = [...new Set(levels.map((a) => a.userId))];
    if (ids.length) resolveEmails({ data: { userIds: ids } }).then(setEmails).catch(() => {});
    if (ids.length) resolveDetails({ data: { userIds: ids } }).then(setDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  // Selection order (not list order) decides each approver's level.
  // Attach each approver's portal name so the create payload's name slots are filled.
  const selected = useMemo(() => withApproverNames(orderSelected(levels, checked), details).map((a) => ({ ...a, group: predefined ? (a as any).group : "" })), [levels, checked, details, predefined]);
  useEffect(() => { onChange?.(selected); }, [selected, onChange]);

  function toggle(i: number) {
    setChecked((prev) => toggleOrdered(prev, i));
  }

  if (predefined ? !plant : !(company && plant)) {
    return <p className="text-sm text-muted-foreground">{predefined ? "Select a Plant to see the approvers." : "Select a Company and Plant to see your Series approvers."}</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading approvers…</p>;
  if (error) return (
    <p className="text-sm text-muted-foreground">
      {error}{" "}
      <button type="button" className="font-medium text-primary underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
    </p>
  );
  const rows = levels.map((a, i) => ({ a, i })).filter(({ a }) => predefined || (a as any).group === seriesFilter);
  const seriesPicker = !predefined && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Series</span>
      <Select value={seriesFilter} onValueChange={setSeriesFilter}>
        <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Select Series" /></SelectTrigger>
        <SelectContent>{seriesOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  if (!predefined && !seriesFilter) return <div className="space-y-3">{seriesPicker}<p className="text-sm text-muted-foreground">Select a Series to see its approvers.</p></div>;
  if (!rows.length && !selected.length) {
    if (!predefined) return <div className="space-y-3">{seriesPicker}<p className="text-sm text-muted-foreground">{sapMessage || "No approvers are assigned to this Series."}</p></div>;
    return <p className="text-sm text-muted-foreground">{sapMessage || "No approvers returned by SAP."}</p>;
  }

  return (
    <div className="space-y-3">
      {seriesPicker}
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{predefined ? "Predefined Approvers" : "Series Approvers"}</p>
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
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">No approvers are assigned to this Series.</td></tr>}
            {rows.map(({ a, i }) => (
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
      {selected.length > 0 && (
        <div className="text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Selected approvers (level-wise)</p>
          <ol className="flex flex-wrap gap-2">
            {selected.map((a) => (
              <li key={`${a.userId}-${a.level}`} className="rounded-md border bg-muted/40 px-2 py-1">
                Level {a.level}: {details[a.userId]?.name || "—"}{a.role ? ` (${a.role})` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
      {selected.length < MIN_CREATE_APPROVERS && (
        <p className="text-sm text-destructive">Please select at least {MIN_CREATE_APPROVERS} approvers.</p>
      )}
    </div>
  );
}
