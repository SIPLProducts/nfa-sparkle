import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { parseApprovalChains, type SapApprovalChain } from "@/lib/sap/master";
import {
  approvalChainResponseMessage,
  buildApprovalChainPayload,
  MAX_APPROVAL_LEVELS,
  type EditableApprovalChain,
} from "@/lib/sap-approval-chain";
import { swalConfirm, toast } from "@/lib/swal";

function toDraft(chain: SapApprovalChain): EditableApprovalChain {
  return {
    pspnr: chain.pspnr,
    funct: chain.funct,
    extraTxt: chain.extraTxt,
    begda: chain.begda,
    endda: chain.endda,
    lineIndex: chain.lineIndex,
    levels: chain.levels.map((level) => ({ designation: level.designation, userId: level.userId })),
  };
}

function emptyDraft(): EditableApprovalChain {
  return { pspnr: "", funct: "", extraTxt: "", begda: "", endda: "99991231", lineIndex: "", levels: [] };
}

async function approvalChainRequest(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again before managing approval chains");
  const response = await fetch("/api/public/sap-approval-chain", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    throw new Error(String(record?.["error"] ?? record?.["MESSAGE"] ?? record?.["message"] ?? text ?? "SAP request failed"));
  }
  return parsed;
}

export function ApprovalChainTab() {
  const [approver, setApprover] = useState("");
  const [chains, setChains] = useState<SapApprovalChain[]>([]);
  const [draft, setDraft] = useState<EditableApprovalChain | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (approverValue: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const parsed = await approvalChainRequest({ approver: approverValue });
      const list = parseApprovalChains(parsed);
      setChains(list);
      if (!list.length) {
        const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
        setNotice(String(record?.["message"] ?? record?.["MESSAGE"] ?? "No approval chains returned by SAP."));
      }
    } catch (requestError) {
      setChains([]);
      setError(requestError instanceof Error ? requestError.message : "Could not reach the SAP approval chain service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const filtered = useMemo(() => {
    const term = approver.trim().toLowerCase();
    if (!term) return chains;
    return chains.filter((chain) =>
      [chain.pspnr, chain.funct, chain.extraTxt, ...chain.levels.flatMap((level) => [level.designation, level.userId])]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [approver, chains]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const parsed = await approvalChainRequest({ payload: buildApprovalChainPayload(draft, editingIndex === null ? "save" : "update") });
      const result = approvalChainResponseMessage(parsed);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
      setDraft(null);
      setEditingIndex(null);
      await load(approver);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Approval chain could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const removeChain = async () => {
    if (!draft) return;
    const confirmed = await swalConfirm({
      title: "Delete this approval chain?",
      text: "All approval levels in this chain will be removed from SAP.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      const parsed = await approvalChainRequest({ payload: buildApprovalChainPayload(draft, "delete") });
      const result = approvalChainResponseMessage(parsed);
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message || "Approval chain deleted");
      setDraft(null);
      setEditingIndex(null);
      await load(approver);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Approval chain could not be deleted");
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    const updateField = (field: keyof Omit<EditableApprovalChain, "levels">, value: string) =>
      setDraft((current) => current ? { ...current, [field]: value } : current);
    const updateLevel = (index: number, field: "designation" | "userId", value: string) =>
      setDraft((current) => current ? {
        ...current,
        levels: current.levels.map((level, levelIndex) => levelIndex === index ? { ...level, [field]: value } : level),
      } : current);
    const moveLevel = (index: number, direction: -1 | 1) => setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.levels.length) return current;
      const levels = [...current.levels];
      const selected = levels.splice(index, 1)[0];
      if (!selected) return current;
      levels.splice(target, 0, selected);
      return { ...current, levels };
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{editingIndex === null ? "New approval chain" : "Edit approval chain"}</h3>
            <p className="text-sm text-muted-foreground">Levels are saved to SAP in the displayed order.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close editor" title="Close editor" onClick={() => setDraft(null)} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Project *" value={draft.pspnr} onChange={(value) => updateField("pspnr", value)} />
          <Field label="NFA Type *" value={draft.funct} onChange={(value) => updateField("funct", value)} />
          <Field label="Function *" value={draft.extraTxt} onChange={(value) => updateField("extraTxt", value)} />
          <Field label="Valid From *" value={draft.begda} onChange={(value) => updateField("begda", value)} placeholder="YYYYMMDD" />
          <Field label="Valid To *" value={draft.endda} onChange={(value) => updateField("endda", value)} placeholder="YYYYMMDD" />
          <Field label="Line Index" value={draft.lineIndex} onChange={(value) => updateField("lineIndex", value)} />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Approval levels</div>
              <div className="text-xs text-muted-foreground">{draft.levels.length} of {MAX_APPROVAL_LEVELS} levels</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={draft.levels.length >= MAX_APPROVAL_LEVELS || saving}
              onClick={() => setDraft((current) => current ? { ...current, levels: [...current.levels, { designation: "", userId: "" }] } : current)}
            >
              <Plus className="h-4 w-4" /> Add level
            </Button>
          </div>
          {draft.levels.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">Add the first approval level.</div>
          ) : (
            <div className="divide-y divide-border">
              {draft.levels.map((level, index) => (
                <div key={index} className="grid gap-3 p-4 sm:grid-cols-[64px_1fr_1fr_auto] sm:items-end">
                  <div className="pb-2 text-sm font-semibold">L{index + 1}</div>
                  <Field label="Designation *" value={level.designation} onChange={(value) => updateLevel(index, "designation", value)} />
                  <Field label="User ID *" value={level.userId} onChange={(value) => updateLevel(index, "userId", value)} />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Move level ${index + 1} up`} title="Move up" disabled={index === 0 || saving} onClick={() => moveLevel(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Move level ${index + 1} down`} title="Move down" disabled={index === draft.levels.length - 1 || saving} onClick={() => moveLevel(index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Delete level ${index + 1}`}
                      title="Delete level"
                      disabled={saving}
                      onClick={() => setDraft((current) => current ? { ...current, levels: current.levels.filter((_, levelIndex) => levelIndex !== index) } : current)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {editingIndex !== null ? (
            <Button variant="destructive" className="gap-2" onClick={() => void removeChain()} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Delete chain
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
          <Button className="gap-2" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save chain
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Add, update, delete, and reorder approval users saved in SAP.</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={approver} onChange={(event) => setApprover(event.target.value)} placeholder="Search chains or users" className="h-9 w-56 pl-8" />
          </div>
          <Button variant="outline" size="icon" aria-label="Reload approval chains" title="Reload" onClick={() => void load(approver)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button className="gap-2" onClick={() => { setEditingIndex(null); setDraft(emptyDraft()); }}>
            <Plus className="h-4 w-4" /> Add chain
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load(approver)}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{notice || "No approval chains match your search."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((chain) => {
            const sourceIndex = chains.indexOf(chain);
            return (
              <div key={`${chain.pspnr}-${chain.funct}-${chain.extraTxt}-${chain.lineIndex}-${sourceIndex}`} className="rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{chain.funct || "—"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[chain.extraTxt, chain.pspnr ? `Project ${chain.pspnr}` : "", chain.begda || chain.endda ? `Valid ${chain.begda || "—"} → ${chain.endda || "—"}` : ""]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">{chain.levels.length} level{chain.levels.length === 1 ? "" : "s"}</Badge>
                    <Button variant="outline" size="sm" onClick={() => { setEditingIndex(sourceIndex); setDraft(toDraft(chain)); }}>Edit</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-2.5 font-medium">Level</th><th className="px-4 py-2.5 font-medium">Designation</th><th className="px-4 py-2.5 font-medium">User ID</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {chain.levels.map((level) => (
                        <tr key={level.level}><td className="px-4 py-2.5 font-medium">L{level.level}</td><td className="px-4 py-2.5">{level.designation || "—"}</td><td className="px-4 py-2.5 font-mono text-xs">{level.userId || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />
    </div>
  );
}