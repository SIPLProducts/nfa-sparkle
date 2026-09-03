import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextEditor, htmlToPlainText } from "@/components/RichTextEditor";
import { PLANTS, COMPANIES } from "@/lib/sap/master";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

/** Session cache of the logged-in user's User ID (profiles.username), keyed by auth user id. */
const sapUserCache: Record<string, string> = {};

interface DraftState {
  subject: string;
  scope_impact: string;
  budget_impact: string;
  timeline_days: string;
  detailed_description: string;
}

const EMPTY_DRAFT: DraftState = {
  subject: "",
  scope_impact: "",
  budget_impact: "",
  timeline_days: "",
  detailed_description: "",
};

/** SAP detail response — keys come straight from SAP, so read defensively. */
type SapDetail = Record<string, unknown>;

/**
 * SAP answers either with a record object or with a plain sentence
 * ("Note For Approval Can Only Be Edited By Initiator"). Never assume JSON.
 */
function readSapPayload(text: string): { record: SapDetail | null; message: string | null } {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { record: null, message: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { record: null, message: trimmed.slice(0, 500) };
  }
  if (typeof parsed === "string") return { record: null, message: parsed };
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    const m = o["message"] ?? o["MESSAGE"] ?? o["error"];
    const hasRecordKeys = ["SUBJECT", "TEXT", "CC_TEXT", "PSPNR", "FUNCT", "SCOPE_IMPACT"].some(
      (k) => o[k] !== undefined,
    );
    if (!hasRecordKeys && typeof m === "string" && m.trim()) return { record: null, message: m.trim() };
  }
  return { record: pickDetail(parsed), message: null };
}

function pickDetail(raw: unknown): SapDetail | null {
  let v: unknown = raw;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    for (const k of ["data", "body", "result", "response"]) {
      if (o[k] !== undefined) { v = o[k]; break; }
    }
  }
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (Array.isArray(v)) v = v[0];
  return v && typeof v === "object" ? (v as SapDetail) : null;
}


function str(d: SapDetail | null, key: string): string {
  const v = d?.[key];
  return v === undefined || v === null ? "" : String(v);
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
        <span className="truncate">{value || "—"}</span>
      </div>
    </div>
  );
}

export function RecordEditDialog({
  row,
  open,
  onOpenChange,
  endpoint = "detail",
  onUpdated,
}: {
  row: SapReportRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Which registered SAP endpoint loads the record: report detail, or MY NFA Select. */
  endpoint?: "detail" | "select";
  /** Called after SAP confirms an update, so the caller can refresh its list. */
  onUpdated?: () => void;
}) {
  const enfa = row?.REFFLD ?? "";
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [detail, setDetail] = useState<SapDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sapNotice, setSapNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  /** Sends the picked files to SAP against this record, using the same endpoint the screen uses. */
  async function uploadFiles(list: File[]) {
    if (!enfa) {
      toast.error("This record has no eNFA number yet.");
      return;
    }
    setUploading(true);
    try {
      const message = await uploadToSap(enfa, list, endpoint === "select" ? "my" : "report");
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }


  const plant = useMemo(() => PLANTS.find((p) => p.code === (row?.PSPNR ?? "")), [row]);
  const company = useMemo(() => COMPANIES.find((c) => c.code === plant?.company), [plant]);

  useEffect(() => {
    if (!open || !enfa) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDetailError(null);
      setSapNotice(null);
      setDetail(null);

      // 1. Live SAP record details for the selected ENFA number.
      let sap: SapDetail | null = null;
      let notice: string | null = null;
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token ?? "";
        // user_name is the logged-in user's User ID (profiles.username), so the
        // request payload in DevTools is exactly what SAP receives.
        let sapUser = "";
        try {
          const uid = s.session?.user?.id ?? "";
          if (uid) {
            if (sapUserCache[uid] === undefined) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", uid)
                .maybeSingle();
              sapUserCache[uid] = (profile?.username ?? "").toUpperCase();
            }
            sapUser = sapUserCache[uid] ?? "";
          }
        } catch {
          sapUser = "";
        }
        const res = await fetch(endpoint === "select" ? "/api/public/enfa-select" : "/api/public/enfa-detail", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ edit: { user_name: sapUser, reffld: enfa } }),
        });
        const text = await res.text();
        if (!res.ok) {
          const failed = readSapPayload(text);
          throw new Error(
            failed.message || `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`,
          );
        }
        const payload = readSapPayload(text);
        sap = payload.record;
        notice = payload.message;
        if (!sap && !notice) throw new Error("SAP returned no details for this record");
      } catch (e) {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : "Could not load record details from SAP");
      }

      if (notice && !sap) {
        if (cancelled) return;
        // SAP replied with a message instead of a record — show it and stay read-only.
        setSapNotice(notice);
        setDetail(null);
        setDraft({
          subject: row?.SUBJECT ?? "",
          scope_impact: "",
          budget_impact: "",
          timeline_days: "",
          detailed_description: "",
        });
        setLoading(false);
        return;
      }


      if (sap) {
        // SAP response is the single source of truth when the live call succeeds.
        if (cancelled) return;
        setDetail(sap);
        setDraft({
          subject: str(sap, "SUBJECT"),
          scope_impact: str(sap, "SCOPE_IMPACT"),
          budget_impact: str(sap, "BUDGET_IMPACT"),
          timeline_days: str(sap, "TIMELINE_IMPACT"),
          detailed_description: str(sap, "TEXT"),
        });
        setLoading(false);
        return;
      }

      // Fallback only when SAP could not be reached: locally saved draft, then the row.
      const { data } = await supabase
        .from("sap_record_draft")
        .select("*")
        .eq("enfa_number", enfa)
        .maybeSingle();
      if (cancelled) return;
      setDetail(null);
      setDraft({
        subject: data?.subject ?? row?.SUBJECT ?? "",
        scope_impact: data?.scope_impact ?? "",
        budget_impact: data?.budget_impact != null ? String(data.budget_impact) : "",
        timeline_days: data?.timeline_days != null ? String(data.timeline_days) : "",
        detailed_description: data?.detailed_description ?? "",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, enfa, row, endpoint]);

  const set = (k: keyof DraftState) => (v: string) => setDraft((p) => ({ ...p, [k]: v }));

  async function sendToSap() {
    if (!enfa) return;
    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token ?? "";
      const payload = {
        submit: {
          reffld: enfa,
          CC_TEXT: str(detail, "CC_TEXT") || (company ? company.name : ""),
          PSPNR: str(detail, "PSPNR") || (row?.PSPNR ?? ""),
          NAME1: str(detail, "NAME1") || (row?.NAME1 ?? ""),
          FUNCT: str(detail, "FUNCT") || str(detail, "FUNCT_TXT") || (row?.FUNCT_TXT ?? ""),
          SUBJECT: draft.subject,
          SCOPE_IMPACT: draft.scope_impact,
          BUDGET_IMPACT: draft.budget_impact,
          TIMELINE_IMPACT: draft.timeline_days,
          TEXT: htmlToPlainText(draft.detailed_description),
        },
      };
      const res = await fetch(endpoint === "select" ? "/api/public/enfa-my-update" : "/api/public/enfa-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`;
        try {
          const p = JSON.parse(text) as { error?: string };
          if (p?.error) msg = p.error;
        } catch { /* keep default */ }
        throw new Error(msg);
      }
      let message = "Record updated in SAP";
      const trimmed = text.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (typeof parsed === "string") message = parsed;
          else if (parsed && typeof parsed === "object") {
            const o = parsed as Record<string, unknown>;
            const m = o["message"] ?? o["MESSAGE"] ?? o["status"] ?? o["result"];
            if (typeof m === "string" && m.trim()) message = m;
          }
        } catch {
          message = trimmed.slice(0, 200);
        }
      }
      toast.success(message);
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSending(false);
    }
  }

  const readOnly = !!sapNotice;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit ENFA · {enfa || "—"}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Loading record…</p>
          ) : (
            <div className="space-y-4">
              {sapNotice ? (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {sapNotice}
                </div>
              ) : null}
              {detailError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {detailError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Company"
                  value={str(detail, "CC_TEXT") || (company ? `${company.code} – ${company.name}` : "")}
                />
                <ReadOnlyField
                  label="Plant"
                  value={
                    [str(detail, "PSPNR") || row?.PSPNR, str(detail, "NAME1") || row?.NAME1]
                      .filter(Boolean)
                      .join(" – ")
                  }
                />
                <ReadOnlyField label="NFA Type" value={str(detail, "FUNCT") || (row?.FUNCT_TXT ?? "")} />
                <ReadOnlyField label="Function" value={row?.EXTR_TXT ?? ""} />
                <ReadOnlyField label="Initiator" value={row?.INIT_NAME ?? ""} />
                <ReadOnlyField label="Creation Date" value={row?.BEGDA ?? ""} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Subject *</Label>
                <Input value={draft.subject} onChange={(e) => set("subject")(e.target.value)} placeholder="Subject of the NFA" disabled={readOnly} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Scope Impact</Label>
                <Textarea
                  rows={3}
                  value={draft.scope_impact}
                  onChange={(e) => set("scope_impact")(e.target.value)}
                  placeholder="Describe the impact on scope"
                  disabled={readOnly}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Budget Impact</Label>
                  <Input
                    type="number"
                    value={draft.budget_impact}
                    onChange={(e) => set("budget_impact")(e.target.value)}
                    placeholder="0.00"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeline Impact (days)</Label>
                  <Input
                    type="number"
                    value={draft.timeline_days}
                    onChange={(e) => set("timeline_days")(e.target.value)}
                    placeholder="0"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="text-sm font-medium">Detailed Description</div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDescOpen(true)} disabled={readOnly}>
                  <FileText className="h-3.5 w-3.5" /> Open
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (list.length) void uploadFiles(list);
              }}
            />
            <Button
              variant="outline"
              className="mr-auto gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !enfa}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload File
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
            {readOnly ? null : (
              <Button className="gap-1.5" onClick={sendToSap} disabled={sending || loading}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
            )}
          </DialogFooter>


        </DialogContent>
      </Dialog>

      <Dialog open={descOpen} onOpenChange={setDescOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Detailed Description · {enfa || "—"}</DialogTitle>
          </DialogHeader>
          <RichTextEditor
            value={draft.detailed_description}
            onChange={set("detailed_description")}
            placeholder="Type the detailed description…"
            minHeight="45vh"
          />
          <DialogFooter>
            <Button onClick={() => setDescOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
