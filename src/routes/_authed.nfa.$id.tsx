import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "@/lib/swal";
import { AttachmentList } from "@/components/AttachmentList";
import { RichTextView } from "@/components/RichTextView";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchProfilesMap, nameFor } from "@/lib/nfa-helpers";
import { STATUS_LABEL, STATUS_TONE, type NfaRow } from "@/lib/nfa-types";
import { nfaTypeName, plantName } from "@/lib/sap/master";

export const Route = createFileRoute("/_authed/nfa/$id")({
  head: () => ({
    meta: [
      { title: "NFA Details | eNFA Portal" },
      { name: "description", content: "View created Note for Approval details and uploaded files." },
      { property: "og:title", content: "NFA Details | eNFA Portal" },
      { property: "og:description", content: "View created Note for Approval details and uploaded files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NfaDetail,
});

type SapDetail = Record<string, unknown>;

function pickSapDetail(raw: unknown): SapDetail | null {
  let value = raw;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    for (const key of ["data", "body", "result", "response"]) {
      if (object[key] !== undefined) {
        value = object[key];
        break;
      }
    }
  }
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) value = value[0];
  return value && typeof value === "object" ? (value as SapDetail) : null;
}

function sapValue(detail: SapDetail | null, ...keys: string[]) {
  for (const key of keys) {
    const value = detail?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function formatSapDate(value: string, fallback: string) {
  if (!value) return new Date(fallback).toLocaleString();
  if (/^\d{8}$/.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return `${month}/${day}/${year}`;
  }
  return value;
}

function NfaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nfa, setNfa] = useState<NfaRow | null>(null);
  const [sapDetail, setSapDetail] = useState<SapDetail | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [attachmentsKey, setAttachmentsKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const { data } = await supabase.from("nfa").select("*").eq("id", id).maybeSingle();
    if (loadId !== loadIdRef.current) return;

    const record = (data as NfaRow) ?? null;
    setNfa(record);
    setSapDetail(null);
    if (!record) return;

    const profileMap = await fetchProfilesMap([record.initiator_id]);
    if (loadId !== loadIdRef.current) return;
    setProfiles(profileMap);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/public/enfa-select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ edit: { reffld: record.enfa_number } }),
      });
      const text = await response.text();
      if (!response.ok || !text.trim()) return;
      const parsed = JSON.parse(text) as unknown;
      if (loadId === loadIdRef.current) setSapDetail(pickSapDetail(parsed));
    } catch {
      // Keep the created record visible when live SAP details are temporarily unavailable.
    }
  }, [id]);

  useEffect(() => {
    setNfa(null);
    setSapDetail(null);
    setProfiles({});
    void load();
    return () => {
      loadIdRef.current += 1;
    };
  }, [load]);

  if (!nfa) return <div className="p-4 text-muted-foreground">Loading…</div>;

  const isInitiator = user?.id === nfa.initiator_id;
  const sapPlant = sapValue(sapDetail, "PSPNR") || nfa.plant || "";
  const sapPlantName = sapValue(sapDetail, "NAME1") || nfa.plant_name || plantName(nfa.plant);
  const company = sapValue(sapDetail, "CC_CODE", "COMPANY_CODE", "BUKRS", "CC_TEXT") || nfa.company;
  const type = sapValue(sapDetail, "FUNCT", "FUNCT_TXT") || nfaTypeName(nfa.nfa_type);
  const functionName = sapValue(sapDetail, "EXTR_TXT") || nfa.function || "";
  const subject = sapValue(sapDetail, "SUBJECT") || nfa.subject;
  const scopeImpact = sapValue(sapDetail, "SCOPE_IMPACT") || nfa.scope_impact || "";
  const budgetImpact = sapValue(sapDetail, "BUDGET_IMPACT") || nfa.budget_impact?.toString() || "";
  const timelineDays = sapValue(sapDetail, "TIMELINE_IMPACT") || nfa.timeline_days?.toString() || "";
  const created = formatSapDate(sapValue(sapDetail, "BEGDA", "CREATED_AT"), nfa.created_at);
  const detailedDescription = nfa.detailed_description || sapValue(sapDetail, "TEXT");

  async function uploadFiles(files: FileList | null) {
    if (!files || !user) return;
    const currentNfa = nfa;
    if (!currentNfa) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${currentNfa.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("nfa_attachment").insert({
          nfa_id: currentNfa.id,
          storage_path: path,
          filename: file.name,
          mime: file.type || null,
          size: file.size,
          uploaded_by: user.id,
        });
        if (insertError) throw insertError;
      }
      await supabase.from("nfa_audit").insert({ nfa_id: currentNfa.id, actor_id: user.id, action: "Uploaded attachment(s)" });
      toast.success("Uploaded");
      setAttachmentsKey((key) => key + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const canUpload = isInitiator && ["with_initiator", "clarification", "rejected"].includes(nfa.status);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/nfa/my" })}
          className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold uppercase text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
          Back
        </button>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end sm:gap-3">
          <div className="flex min-w-0 items-center divide-x divide-border rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
            <span className="shrink-0 pr-3 text-[11px] font-medium uppercase text-muted-foreground">ENFA</span>
            <span className="min-w-0 truncate pl-3 text-sm font-bold text-foreground tabular-nums">{nfa.enfa_number}</span>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase shadow-sm ${STATUS_TONE[nfa.status]}`}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            <span className="truncate">{STATUS_LABEL[nfa.status]}</span>
          </span>
        </div>
      </div>

      <Card className="border-border">
        <div className="relative flex items-center justify-center border-b border-border bg-muted/50 px-4 py-3 sm:py-4">
          <h1 className="text-center font-display text-sm font-bold uppercase text-foreground sm:text-base md:text-lg">
            Note <span className="text-muted-foreground">for</span> Approval
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 text-sm sm:gap-4 sm:p-6 md:grid-cols-2">
          <ReadField label="Company" value={company} />
          <ReadField label="Plant" value={[sapPlant, sapPlantName].filter(Boolean).join(" – ")} />
          <ReadField label="NFA Type" value={type} />
          <ReadField label="Function" value={functionName} />
          <ReadField label="Subject" value={subject} className="md:col-span-2" />
          <ReadField label="Scope Impact" value={scopeImpact} className="md:col-span-2" />
          <ReadField label="Budget (Lakhs)" value={budgetImpact} />
          <ReadField label="Timeline (Days)" value={timelineDays} />
          <ReadField label="Initiator" value={nameFor(profiles, nfa.initiator_id)} />
          <ReadField label="Created" value={created} />
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Detailed Description</Label>
            <RichTextView
              html={detailedDescription}
              className="mt-1 min-h-16 rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>
      </Card>

      <AttachmentList
        nfaId={nfa.id}
        refreshKey={attachmentsKey}
        title="Supporting Documents"
        emptyText="No attachments uploaded yet."
      />

      {canUpload ? (
        <div className="flex justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> Upload Attachment
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                void uploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
              disabled={busy}
            />
          </label>
        </div>
      ) : null}

      {isInitiator && (nfa.status === "in_process" || nfa.status === "completed") ? (
        <p className="text-right text-xs text-muted-foreground">
          Attachments are locked while this NFA is {nfa.status === "in_process" ? "under approval" : "completed"}.
        </p>
      ) : null}
    </div>
  );
}

function ReadField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 min-h-9 rounded border border-border bg-background px-3 py-2 text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
