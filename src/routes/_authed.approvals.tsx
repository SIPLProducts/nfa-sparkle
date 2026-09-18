import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useScreenEntryEffect } from "@/hooks/use-screen-entry-effect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, Eye, FileText, HelpCircle, Loader2, Paperclip, Printer, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { PrintFormDialog } from "@/components/document/PrintFormDialog";
import type { EnfaDocumentApprover, EnfaDocumentComment } from "@/components/document/EnfaDocument";
import { loadPrintComments, sapApproverUserId } from "@/lib/print-form-data";

import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { toast } from "sonner";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { RecordAttachmentsDialog } from "@/components/report/RecordAttachmentsDialog";
import { RecordPreviewDialog } from "@/components/report/RecordPreviewDialog";
import { ApprovalAction, ApprovalCommentDialog } from "@/components/ApprovalCommentDialog";
import { COMPANIES, PLANTS } from "@/lib/sap/master";

export const Route = createFileRoute("/_authed/approvals")({
  component: ApprovalsInbox,
});

/** Session cache of the logged-in user's User ID (profiles.username), keyed by auth user id. */
const sapUserCache: Record<string, string> = {};

/** Resolves the logged-in user's User ID, uppercased ("" when unavailable). */
async function resolveMySapUser(userId: string): Promise<string> {
  if (!userId) return "";
  if (sapUserCache[userId] !== undefined) return sapUserCache[userId] ?? "";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    sapUserCache[userId] = (profile?.username ?? "").toUpperCase();
  } catch {
    sapUserCache[userId] = "";
  }
  return sapUserCache[userId] ?? "";
}

/** Normalises SAP's response into upper-cased string rows. */
function normaliseRows(value: unknown): SapReportRow[] {
  let v = value;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    for (const k of ["body", "data", "ITEMS", "items", "result", "RESULT"]) {
      if (Array.isArray(obj[k])) { v = obj[k]; break; }
    }
  }
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[]).map((r) => {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(r)) out[k.trim().toUpperCase()] = val == null ? "" : String(val);
    return out as unknown as SapReportRow;
  });
}

/** Derives a badge tone from whatever status text SAP returns. */
function statusTone(text: string): string {
  const s = (text || "").toLowerCase();
  if (s.includes("reject")) return "bg-destructive/10 text-destructive";
  if (s.includes("approve") || s.includes("complete") || s.includes("closed")) return "bg-success/10 text-success";
  if (s.includes("clarif") || s.includes("initiator") || s.includes("back")) return "bg-accent/10 text-accent";
  if (s.includes("process") || s.includes("pending") || s.includes("with")) return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

function val(row: SapReportRow, key: string): string {
  return ((row as unknown as Record<string, string>)[key] ?? "").trim();
}

type SapDetail = Record<string, string>;

function firstValue(source: SapDetail | null, ...keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key]?.trim();
    if (value) return value;
  }
  return "";
}

function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

/** Extracts and normalises the complete SAP record returned by the existing select endpoint. */
function readDetailResponse(text: string): { detail: SapDetail | null; message: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { detail: null, message: "SAP returned no details for this record" };
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { detail: null, message: trimmed.slice(0, 500) };
  }
  if (typeof value === "string") return { detail: null, message: value };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const wrapper = value as Record<string, unknown>;
    for (const key of ["data", "body", "result", "response"]) {
      if (wrapper[key] !== undefined) {
        value = wrapper[key];
        break;
      }
    }
  }
  if (typeof value === "string") {
    const nestedText = value;
    try { value = JSON.parse(nestedText); } catch { return { detail: null, message: nestedText }; }
  }
  if (Array.isArray(value)) value = value[0];
  if (!value || typeof value !== "object") return { detail: null, message: "SAP returned no details for this record" };
  const detail: SapDetail = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    detail[key.trim().toUpperCase()] = raw == null ? "" : String(raw);
  }
  const message = firstValue(detail, "MESSAGE", "ERROR");
  const hasRecord = ["REFFLD", "SUBJECT", "CC_TEXT", "PSPNR", "FUNCT", "FUNCT_TXT"].some((key) => firstValue(detail, key));
  return hasRecord ? { detail, message: null } : { detail: null, message: message || "SAP returned no details for this record" };
}

interface ApprovalPrintDocument {
  companyName: string;
  plantLabel: string;
  date: string;
  initiator: string;
  nfaType: string;
  functionName: string;
  subject: string;
  scope: string;
  budget: string;
  timeline: string;
  description: string;
  approvers: EnfaDocumentApprover[];
}

const EMPTY_PRINT_DOCUMENT: ApprovalPrintDocument = {
  companyName: "", plantLabel: "", date: "", initiator: "", nfaType: "", functionName: "",
  subject: "", scope: "", budget: "", timeline: "", description: "", approvers: [],
};

/** NFA Type: FUNCT_TXT when present, else FUNCT (as in the get_data response). */
function nfaType(row: SapReportRow): string {
  return val(row, "FUNCT_TXT") || val(row, "FUNCT") || "—";
}

/** Finds the total number of approval levels present in the row. */
function totalLevels(row: SapReportRow): number {
  let count = 0;
  for (const l of LEVELS) {
    if (val(row, `APPR${l}`)) count = l;
  }
  return count || 1;
}

/** Finds the current pending level based on empty statuses. */
function currentLevel(row: SapReportRow): number {
  for (const l of LEVELS) {
    if (!val(row, `STAT${l}`)) return l;
  }
  return totalLevels(row);
}

function ApprovalsInbox() {
  
  const [rows, setRows] = useState<SapReportRow[]>([]);
  const [, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printDoc, setPrintDoc] = useState<ApprovalPrintDocument>(EMPTY_PRINT_DOCUMENT);
  const [printComments, setPrintComments] = useState<EnfaDocumentComment[]>([]);

  const [commentAction, setCommentAction] = useState<ApprovalAction | null>(null);
  const [busy, setBusy] = useState(false);

  const { hasRole } = useAuth();
  const rejectLabel = hasRole("initiator") ? "Cancel" : "Reject";

  const load = useCallback(async (opts?: { background?: boolean; signal?: AbortSignal }) => {
    const background = opts?.background === true;
    if (!background) {
      setLoading(true);
      setSelected(null);
    }
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const userId = sessionData.session?.user?.id ?? "";
      // user_name is the logged-in user's User ID (profiles.username), so the
      // browser posts exactly the payload SAP receives — visible in Network.
      const userName = await resolveMySapUser(userId);
      const res = await fetch("/api/public/enfa-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ get_data: { user_name: userName } }),
        signal: opts?.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

      const asObj = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;

      if (!res.ok || (asObj && asObj["ok"] === false)) {
        const msg =
          (asObj && (asObj["message"] || asObj["error"])) ||
          `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`;
        setRows([]);
        setError(String(msg));
        return;
      }
      // SAP's plain-text "no records" reply arrives wrapped as { message }.
      if (asObj && typeof asObj["message"] === "string") {
        setRows([]);
        setError(String(asObj["message"]));
        return;
      }
      setRows(normaliseRows(parsed));
      setFetchedAt(Date.now());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Could not reach SAP";
      setRows([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useScreenEntryEffect("/approvals", () => {
    setQ("");
    setSelected(null);
    setRows([]);
    setFetchedAt(0);
    setError(null);
    setDocsOpen(false);
    setPreviewOpen(false);
    setCommentAction(null);
    const controller = new AbortController();
    void load({ signal: controller.signal });
    return () => controller.abort();
  });

  /** SAP decides what appears here — no client-side filtering by user. */
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      val(r, "REFFLD").toLowerCase().includes(s) ||
      val(r, "SUBJECT").toLowerCase().includes(s) ||
      nfaType(r).toLowerCase().includes(s) ||
      val(r, "NAME1").toLowerCase().includes(s),
    );
  }, [q, rows]);

  /** Status / level columns only render when SAP actually returns those keys. */
  const hasStatus = useMemo(() => rows.some((r) => val(r, "STATUS_TXT")), [rows]);
  const hasLevels = useMemo(
    () => rows.some((r) => LEVELS.some((l) => val(r, `APPR${l}`) || val(r, `STAT${l}`))),
    [rows],
  );

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(filtered.length, 10, 10);
  const visible = filtered.slice(0, visibleCount);

  const selectedRow = selected !== null ? filtered[selected] ?? null : null;
  const selectedEnfaNo = selectedRow ? val(selectedRow, "REFFLD") : "";

  const worklistPrintApprovers: EnfaDocumentApprover[] = useMemo(
    () => {
      const source = selectedRow as unknown as Record<string, string> | null;
      const fromRow = (...keys: string[]) => {
        for (const key of keys) {
          const value = source?.[key]?.trim();
          if (value) return value;
        }
        return "";
      };
      return LEVELS
        .map((n) => ({
          role: fromRow(`ROLE${n}`, `DESIG${n}`, `DESIGNATION${n}`),
          userId: fromRow(`USERID${n}`) || sapApproverUserId(source, n),
          name: fromRow(`APPR${n}`, `APPROVER${n}`, `APPR_NAME${n}`),
          status: fromRow(`STAT${n}`, `STATUS${n}`),
          actedDate: fromRow(`ACT_DATE${n}`, `APPR_DATE${n}`, `DATE${n}`),
          actedTime: fromRow(`ACT_TIME${n}`, `APPR_TIME${n}`, `TIME${n}`),
        }))
        .filter((approver) =>
          approver.role || approver.userId || approver.name || approver.status || approver.actedDate || approver.actedTime,
        );
    },
    [selectedRow],
  );

  /** Merges the same complete SAP record used by Edit with saved content and worklist fallbacks. */
  async function openPrintForm() {
    if (!selectedEnfaNo || !selectedRow || printLoading) return;
    setPrintLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const userId = sessionData.session?.user?.id ?? "";
      const userName = await resolveMySapUser(userId);
      const requestDetails = (endpoint: string) =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ edit: { user_name: userName, reffld: selectedEnfaNo } }),
        })
          .then(async (response) => ({ response, text: await response.text() }))
          .catch((error: unknown) => ({
            response: null,
            text: error instanceof Error ? error.message : "Could not load complete SAP details",
          }));

      const [editDetailResult, selectDetailResult, draftResult, comments] = await Promise.all([
        requestDetails("/api/public/enfa-detail"),
        requestDetails("/api/public/enfa-select"),
        supabase
          .from("sap_record_draft")
          .select("subject, scope_impact, budget_impact, timeline_days, detailed_description")
          .eq("enfa_number", selectedEnfaNo)
          .maybeSingle(),
        loadPrintComments(selectedEnfaNo),
      ]);

      const parseResult = (result: typeof editDetailResult) => {
        const parsed = readDetailResponse(result.text);
        return result.response?.ok
          ? parsed
          : { detail: null, message: parsed.message || "Could not load complete SAP details" };
      };
      const editParsed = parseResult(editDetailResult);
      const selectParsed = parseResult(selectDetailResult);
      const editDetail = editParsed.detail;
      const selectDetail = selectParsed.detail;
      const draft = draftResult.data;
      const fromWorklist = (...keys: string[]) => keys.map((key) => val(selectedRow, key)).find(Boolean) || "";
      const merged = (...keys: string[]) => firstNonBlank(
        firstValue(editDetail, ...keys),
        firstValue(selectDetail, ...keys),
        fromWorklist(...keys),
      );
      const selectedPlantCode = merged("PSPNR", "PLANT", "PLANT_CODE");
      const savedPlant = PLANTS.find((plant) => plant.code === selectedPlantCode);
      const savedCompany = COMPANIES.find((company) => company.code === savedPlant?.company);
      const approvers = LEVELS.map((level) => ({
        role: merged(
          `ROLE${level}`,
          `DESIG${level}`,
          `DESIGNATION${level}`,
          `APPR_ROLE${level}`,
        ),
        userId: merged(
          `USERID${level}`,
          `USER_ID${level}`,
          `USER${level}`,
          `USRID${level}`,
          `UID${level}`,
          `PERNR${level}`,
          `EMPID${level}`,
          `APPR_USER${level}`,
          `APPR_ID${level}`,
        ),
        name: merged(
          `APPR${level}`,
          `APPROVER${level}`,
          `APPR_NAME${level}`,
          `APPROVER_NAME${level}`,
          `USER_NAME${level}`,
        ),
        status: merged(`STAT${level}`, `STATUS${level}`),
        actedDate: merged(`ACT_DATE${level}`, `APPR_DATE${level}`, `DATE${level}`),
        actedTime: merged(`ACT_TIME${level}`, `APPR_TIME${level}`, `TIME${level}`),
      })).filter((approver) =>
        approver.role || approver.userId || approver.name || approver.status || approver.actedDate || approver.actedTime,
      );

      setPrintDoc({
        companyName: firstNonBlank(merged("CC_TEXT", "COMPANY_NAME", "BUKRS_TEXT", "BUTXT"), savedCompany?.name),
        plantLabel: [selectedPlantCode, firstNonBlank(merged("NAME1", "PLANT_NAME"), savedPlant?.name)].filter(Boolean).join(" – "),
        date: merged("BEGDA", "DATE", "CREATED_AT"),
        initiator: merged("INIT_NAME", "INITIATOR_NAME", "INITIATOR", "USER_NAME"),
        nfaType: merged("FUNCT", "FUNCT_TXT", "NFA_TYPE"),
        functionName: merged("EXTR_TXT", "FUNCTION_NAME", "FUNCTION"),
        subject: firstNonBlank(merged("SUBJECT"), draft?.subject),
        scope: firstNonBlank(merged("SCOPE_IMPACT"), draft?.scope_impact),
        budget: firstNonBlank(merged("BUDGET_IMPACT"), draft?.budget_impact),
        timeline: firstNonBlank(merged("TIMELINE_IMPACT", "TIMELINE_DAYS"), draft?.timeline_days),
        description: firstNonBlank(draft?.detailed_description, merged("TEXT", "DETAILED_DESCRIPTION")),
        approvers: approvers.length ? approvers : worklistPrintApprovers,
      });
      setPrintComments(comments);
      setPrintOpen(true);
      if (!editDetail && !selectDetail) {
        const message = editParsed.message || selectParsed.message;
        if (message) toast.warning(`${message}. Showing available saved details.`);
      }
    } catch (error) {
      const selectedPlantCode = val(selectedRow, "PSPNR");
      const selectedPlant = PLANTS.find((plant) => plant.code === selectedPlantCode);
      const selectedCompany = COMPANIES.find((company) => company.code === selectedPlant?.company);
      setPrintDoc({
        companyName: firstNonBlank(val(selectedRow, "CC_TEXT"), selectedCompany?.name),
        plantLabel: [selectedPlantCode, firstNonBlank(val(selectedRow, "NAME1"), selectedPlant?.name)].filter(Boolean).join(" – "),
        date: val(selectedRow, "BEGDA"),
        initiator: val(selectedRow, "INIT_NAME"),
        nfaType: firstNonBlank(val(selectedRow, "FUNCT"), val(selectedRow, "FUNCT_TXT")),
        functionName: val(selectedRow, "EXTR_TXT"),
        subject: val(selectedRow, "SUBJECT"),
        scope: val(selectedRow, "SCOPE_IMPACT"),
        budget: val(selectedRow, "BUDGET_IMPACT"),
        timeline: firstNonBlank(val(selectedRow, "TIMELINE_IMPACT"), val(selectedRow, "TIMELINE_DAYS")),
        description: firstNonBlank(val(selectedRow, "TEXT"), val(selectedRow, "DETAILED_DESCRIPTION")),
        approvers: worklistPrintApprovers,
      });
      setPrintComments([]);
      setPrintOpen(true);
      toast.warning(error instanceof Error ? `${error.message}. Showing available saved details.` : "Showing available saved details.");
    } finally {
      setPrintLoading(false);
    }
  }


  function requireSelection() {
    if (!selectedRow || !selectedEnfaNo) {
      toast.info("Select a record first.");
      return false;
    }
    return true;
  }

  async function submitAction(action: ApprovalAction, comment: string) {
    if (!selectedEnfaNo) {
      toast.info("Select a record first.");
      return;
    }
    setBusy(true);
    try {
      if (
        action === "approve" ||
        action === "reject" ||
        action === "back_to_initiator" ||
        action === "clarification"
      ) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? "";
        const res = await fetch("/api/public/enfa-approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action, reffld: selectedEnfaNo, comment }),
        });
        const text = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try { parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null; } catch { parsed = null; }

        const message = String(parsed?.["message"] ?? parsed?.["error"] ?? "").trim();
        if (!res.ok || parsed?.["ok"] === false) {
          toast.error(message || `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`);
          return;
        }
        const fallbackMsg =
          action === "approve"
            ? "SAP accepted the approval"
            : action === "reject"
              ? "SAP accepted the rejection"
              : action === "clarification"
                ? "SAP sent the record back for clarification"
                : "SAP sent the record back to the initiator";
        toast.success(message || fallbackMsg);
      } else {
        toast.info("This action is not yet connected to SAP.");
        return;
      }

      setCommentAction(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }


  const emptyText = error
    ? error
    : q
      ? "Try a different search."
      : "SAP returned no records.";

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Approvals Inbox"
        subtitle="Items currently waiting for your decision."
        actions={
          <>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ENFA #, subject…" className="h-9 w-full pl-9 sm:w-64" />
            </div>
          </>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {selectedEnfaNo ? <span className="ml-2 font-mono text-xs text-accent">{selectedEnfaNo}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!selectedEnfaNo || printLoading} onClick={() => { if (requireSelection()) void openPrintForm(); }}>
              {printLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print Form
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setDocsOpen(true)}>
              <Paperclip className="h-3.5 w-3.5" /> Attached Docs
            </Button>
            <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/90" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("approve")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("reject")}>
              <X className="h-3.5 w-3.5" /> {rejectLabel}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 border-accent" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("back_to_initiator")}>
              <RotateCcw className="h-3.5 w-3.5" /> Back To Initiator
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 border-primary" disabled={!selectedEnfaNo} onClick={() => requireSelection() && setCommentAction("clarification")}>
              <HelpCircle className="h-3.5 w-3.5" /> Clarification
            </Button>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="space-y-2.5 md:hidden">
          {loading && <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
              <div className="text-sm font-medium">{error ? "Worklist unavailable" : "No items"}</div>
              <div className="mx-auto max-w-sm text-xs text-muted-foreground">{emptyText}</div>
              {error && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => void load()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
            </div>
          )}
          {visible.map((r, i) => {
            const status = val(r, "STATUS_TXT");
            const cur = currentLevel(r);
            const tot = totalLevels(r);
            return (
              <button
                key={`${val(r, "REFFLD")}-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                className={"block w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm active:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="approval-record"
                      className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                      checked={selected === i}
                      onChange={() => setSelected(i)}
                      aria-label={`Select ${val(r, "REFFLD")}`}
                    />
                    <span className="font-mono text-[11px] font-semibold text-accent">{val(r, "REFFLD") || "—"}</span>
                  </span>
                  {hasStatus && (
                    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + statusTone(status)}>{status || "—"}</span>
                  )}
                </div>
                <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{val(r, "SUBJECT") || "—"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {nfaType(r)} · {val(r, "PSPNR") || "—"} · {val(r, "BEGDA") || "—"}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{val(r, "NAME1") || "—"}</span>
                  {hasLevels && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Level {cur} / {tot}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {hasMore && (
            <div ref={setSentinel} className="py-3 text-center text-[11px] text-muted-foreground">
              Loading more… <span className="text-foreground/60">({visibleCount} of {filtered.length})</span>
            </div>
          )}
          {!loading && filtered.length > 0 && !hasMore && filtered.length > 10 && (
            <div className="py-3 text-center text-[11px] text-muted-foreground">All {filtered.length} loaded</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th> </Th>
                  <Th>ENFA No</Th>
                  <Th>Plant</Th>
                  <Th>Plant Name</Th>
                  <Th>NFA Type</Th>
                  <Th>Date</Th>
                  <Th>Subject</Th>
                  {hasStatus && <Th>Status</Th>}
                  {hasLevels && <Th>Level</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={20}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={20} className="px-4 py-12 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <div className="text-sm font-medium">{error ? "Worklist unavailable" : "No items"}</div>
                    <div className="text-xs text-muted-foreground">{emptyText}</div>
                    {error && (
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => void load()}>
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                  </td></tr>
                )}
                {filtered.map((r, i) => {
                  const status = val(r, "STATUS_TXT");
                  const cur = currentLevel(r);
                  const tot = totalLevels(r);
                  return (
                    <tr
                      key={`${val(r, "REFFLD")}-${i}`}
                      onClick={() => setSelected(i)}
                      className={"cursor-pointer hover:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
                    >
                      <Td>
                        <input
                          type="radio"
                          name="approval-record-desktop"
                          className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                          checked={selected === i}
                          onChange={() => setSelected(i)}
                          aria-label={`Select ${val(r, "REFFLD")}`}
                        />
                      </Td>
                      <Td><span className="font-mono text-xs font-medium text-accent">{val(r, "REFFLD") || "—"}</span></Td>
                      <Td>{val(r, "PSPNR") || "—"}</Td>
                      <Td className="text-muted-foreground">{val(r, "NAME1") || "—"}</Td>
                      <Td>{nfaType(r)}</Td>
                      <Td className="text-muted-foreground">{val(r, "BEGDA") || "—"}</Td>
                      <Td className="max-w-[280px] truncate">{val(r, "SUBJECT") || "—"}</Td>
                      {hasStatus && (
                        <Td><span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + statusTone(status)}>{status || "—"}</span></Td>
                      )}
                      {hasLevels && (
                        <Td>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            Level {cur} / {tot}
                          </span>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecordAttachmentsDialog
        enfaNumber={selectedEnfaNo || null}
        open={docsOpen}
        onOpenChange={setDocsOpen}
        endpoint="my"
      />
      <RecordPreviewDialog row={selectedRow} open={previewOpen} onOpenChange={setPreviewOpen} endpoint="select" />
      <PrintFormDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        companyName={printDoc.companyName}
        nfaNo={selectedEnfaNo}
        plantLabel={printDoc.plantLabel}
        date={printDoc.date}
        initiator={printDoc.initiator}
        nfaType={printDoc.nfaType}
        functionName={printDoc.functionName}
        subject={printDoc.subject}
        scopeImpact={printDoc.scope}
        timelineDays={printDoc.timeline}
        budgetImpact={printDoc.budget}
        descriptionHtml={printDoc.description}
        approvers={printDoc.approvers}
        comments={printComments}

      />
      <ApprovalCommentDialog
        open={!!commentAction}
        onOpenChange={(o) => { if (!o) setCommentAction(null); }}
        enfaNumber={selectedEnfaNo || "—"}
        action={commentAction}
        onSubmit={submitAction}
        busy={busy}
      />
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 whitespace-nowrap font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 whitespace-nowrap " + className}>{children}</td>;
}
