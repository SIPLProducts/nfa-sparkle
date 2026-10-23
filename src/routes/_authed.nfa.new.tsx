import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseCompanyF4, parsePlantF4, parseEnfaTypeF4, parseFunctionF4, nfaTypeDisplayLabel } from "@/lib/sap/master";
import type { Option } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { RichTextEditor, htmlToPlainText } from "@/components/RichTextEditor";
import { toast } from "@/lib/swal";
import { Send, FileText, Building2, Paperclip, Upload, X, Users } from "lucide-react";
import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { generateEnfaDocx } from "@/lib/enfa-docx.functions";
import { embedDescriptionImages, fileToBase64, saveGeneratedDocx } from "@/lib/enfa-working-document";
import { fetchSapApprovalFlow, mergeApprovalFlow } from "@/lib/sap-approval-flow";
import { ApproverSelector } from "@/components/nfa/ApproverSelector";
import { wrapCreatePayload, approverModeCheck, MIN_CREATE_APPROVERS } from "@/lib/sap-api-constants";

export const Route = createFileRoute("/_authed/nfa/new")({
  head: () => ({
    meta: [
      { title: "Create NFA | NFA Portal" },
      { name: "description", content: "Create and submit a new NFA request." },
      { property: "og:title", content: "Create NFA | NFA Portal" },
      { property: "og:description", content: "Create and submit a new NFA request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewNfaPage,
});

interface ApproverDraft { level: number; email: string; designation: string }

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

async function fetchCompanyLogoForDocx(companyCode: string, token: string): Promise<string | undefined> {
  if (!companyCode || !token) return undefined;
  const response = await fetch("/api/public/sap-logo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ companyCode }),
  });
  const result = (await response.json()) as { ok?: boolean; dataUrl?: string; message?: string; error?: string };
  if (!response.ok || !result.ok || !result.dataUrl) {
    throw new Error(result.message || result.error || "Company logo is unavailable");
  }
  const dataUrl = result.dataUrl;
  if (dataUrl.startsWith("data:image/png")) return dataUrl;
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("The company logo cannot be converted for Word"));
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("The company logo format cannot be opened"));
    image.src = dataUrl;
  });
}

function NewNfaPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const generateDocx = useServerFn(generateEnfaDocx);
  const [company, setCompany] = useState("");
  const [plant, setPlant] = useState("");
  const [approverMode, setApproverMode] = useState<"predefined" | "dynamic">("predefined");
  const [selectedApprovers, setSelectedApprovers] = useState<EnfaDocumentApprover[]>([]);
  const [approversOpen, setApproversOpen] = useState(false);
  const [nfaType, setNfaType] = useState("");
  const [func, setFunc] = useState("");
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [desc, setDesc] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [approvers, setApprovers] = useState<ApproverDraft[]>([{ level: 1, email: "", designation: "" }]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [initiatorName, setInitiatorName] = useState("");
  const [companies, setCompanies] = useState<Option[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState("");
  const [plants, setPlants] = useState<Option[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [plantsError, setPlantsError] = useState("");
  const [plantReload, setPlantReload] = useState(0);
  const [nfaTypes, setNfaTypes] = useState<Option[]>([]);
  const [nfaTypesLoading, setNfaTypesLoading] = useState(true);
  const [nfaTypesError, setNfaTypesError] = useState("");
  const [nfaTypeReload, setNfaTypeReload] = useState(0);
  const [functions, setFunctions] = useState<Option[]>([]);
  const [functionsLoading, setFunctionsLoading] = useState(false);
  const [functionsError, setFunctionsError] = useState("");
  const [functionReload, setFunctionReload] = useState(0);
  const plainDesc = htmlToPlainText(desc);

  useEffect(() => {
    const userId = user?.id ?? "";
    if (!userId) {
      setInitiatorName("");
      return;
    }
    let cancelled = false;
    void supabase.rpc("get_profiles_basic", { _ids: [userId] }).then(({ data }) => {
      if (cancelled) return;
      const profile = (data ?? [])[0] as { full_name: string | null } | undefined;
      setInitiatorName(profile?.full_name?.trim() ?? "");
    });
    return () => { cancelled = true; };
  }, [user?.id]);


  // Company list comes from the SAP "Company F4" endpoint registered in Admin → SAP API Settings.
  const [companyReload, setCompanyReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCompaniesLoading(true);
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch("/api/public/sap-company", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: "{}",
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
        const list = res.ok ? parseCompanyF4(parsed) : [];
        if (cancelled) return;
        if (list.length) { setCompanies(list); setCompaniesError(""); }
        else {
          const p = parsed as Record<string, unknown> | null;
          const detail =
            (p && typeof p === "object" && (p["error"] ?? p["MESSAGE"] ?? p["message"])) ||
            (text ? text.slice(0, 300) : "") ||
            `SAP responded with status ${res.status}`;
          setCompanies([]);
          setCompaniesError(`SAP: ${String(detail)}`);
        }
      } catch {
        if (!cancelled) {
          setCompanies([]);
          setCompaniesError("Could not reach the SAP company service.");
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyReload]);

  // Plant list comes from the SAP "Plant F4" endpoint registered in Admin → SAP API Settings.
  useEffect(() => {
    if (!company) { setPlants([]); setPlantsError(""); setPlantsLoading(false); setPlant(""); return; }
    let cancelled = false;
    setPlantsLoading(true);
    setPlant("");
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch("/api/public/sap-plant", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ bukrs: company }),
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
        const list = res.ok ? parsePlantF4(parsed) : [];
        if (cancelled) return;
        if (list.length) { setPlants(list); setPlantsError(""); }
        else {
          const p = parsed as Record<string, unknown> | null;
          const detail =
            (p && typeof p === "object" && (p["error"] ?? p["MESSAGE"] ?? p["message"])) ||
            (text ? text.slice(0, 300) : "") ||
            `SAP responded with status ${res.status}`;
          setPlants([]);
          setPlantsError(res.ok ? "SAP returned no plants for this company." : `SAP: ${String(detail)}`);
        }
      } catch {
        if (!cancelled) { setPlants([]); setPlantsError("Could not reach the SAP plant service."); }
      } finally {
        if (!cancelled) setPlantsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [company, plantReload]);

  // NFA Type list comes from the SAP "ENFA Type F4" endpoint registered in Admin → SAP API Settings.
  useEffect(() => {
    let cancelled = false;
    setNfaTypesLoading(true);
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch("/api/public/sap-enfa-type", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: "{}",
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
        const list = res.ok ? parseEnfaTypeF4(parsed) : [];
        if (cancelled) return;
        if (list.length) { setNfaTypes(list); setNfaTypesError(""); }
        else {
          const p = parsed as Record<string, unknown> | null;
          const detail =
            (p && typeof p === "object" && (p["error"] ?? p["MESSAGE"] ?? p["message"])) ||
            (text ? text.slice(0, 300) : "") ||
            `SAP responded with status ${res.status}`;
          setNfaTypes([]);
          setNfaTypesError(res.ok ? "SAP returned no NFA types." : `SAP: ${String(detail)}`);
        }
      } catch {
        if (!cancelled) { setNfaTypes([]); setNfaTypesError("Could not reach the SAP NFA type service."); }
      } finally {
        if (!cancelled) setNfaTypesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nfaTypeReload]);

  // Function list comes from the SAP "Function F4" endpoint registered in Admin → SAP API Settings.
  useEffect(() => {
    if (!nfaType) { setFunctions([]); setFunctionsError(""); setFunctionsLoading(false); setFunc(""); return; }
    let cancelled = false;
    setFunctionsLoading(true);
    setFunc("");
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch("/api/public/sap-function", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ nfaType }),
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
        const list = res.ok ? parseFunctionF4(parsed) : [];
        if (cancelled) return;
        if (list.length) { setFunctions(list); setFunctionsError(""); }
        else {
          const p = parsed as Record<string, unknown> | null;
          const detail =
            (p && typeof p === "object" && (p["error"] ?? p["MESSAGE"] ?? p["message"])) ||
            (text ? text.slice(0, 300) : "") ||
            `SAP responded with status ${res.status}`;
          setFunctions([]);
          setFunctionsError(res.ok ? "SAP returned no functions for this NFA type." : `SAP: ${String(detail)}`);
        }
      } catch {
        if (!cancelled) { setFunctions([]); setFunctionsError("Could not reach the SAP function service."); }
      } finally {
        if (!cancelled) setFunctionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nfaType, functionReload]);


  function addFiles(list: FileList | null) {
    if (!list) return;
    const MAX = 20 * 1024 * 1024;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX) { toast.error(`${f.name} exceeds 20 MB and was skipped`); continue; }
      accepted.push(f);
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }
  function removeFile(idx: number) {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(_asDraft: boolean) {
    if (!user) return;
    if (!company || !nfaType || !subject) return toast.error("Company, NFA Type and Subject are required");
    if (selectedApprovers.length < MIN_CREATE_APPROVERS) {
      return toast.error(`Please select at least ${MIN_CREATE_APPROVERS} approvers before submitting.`);
    }
    setBusy(true);
    try {
      const plantObj = plants.find((p) => p.code === plant);
      // The NFA is stored only in SAP — nothing is written to the app database or storage.
      const sap = await submitToSap(plantObj?.name ?? "");
      if (!sap.ok) {
        toast.error(sap.message);
        return;
      }
      toast.success(sap.message);
      nav({ to: "/nfa/my" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Reads a file as a base64 string (without the data-url prefix). */
  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = String(reader.result ?? "");
        resolve(r.includes(",") ? r.slice(r.indexOf(",") + 1) : r);
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  /** Finds SAP's MESSAGE anywhere in its reply. */
  function findSapMessage(value: unknown, depth = 0): string {
    if (!value || typeof value !== "object" || depth > 6) return "";
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (/^message$/i.test(key) && typeof obj[key] === "string" && String(obj[key]).trim()) return String(obj[key]).trim();
    }
    for (const v of Object.values(obj)) {
      const found = findSapMessage(v, depth + 1);
      if (found) return found;
    }
    return "";
  }

  /** Sends the record to SAP; success only when SAP confirms with an eNFA number. */
  async function submitToSap(plantName: string): Promise<{ ok: boolean; message: string }> {
    try {
      const files: Array<{ file_name: string; file: string }> = [];
      for (const f of pending) {
        try {
          files.push({ file_name: f.name, file: await toBase64(f) });
        } catch (err) {
          return { ok: false, message: (err as Error).message };
        }
      }
      // user_name is the logged-in user's User ID (profiles.username) — never hardcoded.
      const sapUser = await resolveMySapUser(user?.id ?? "");
      const payload = wrapCreatePayload(
        {
          user_name: sapUser,
          CC_code: company,
          PSPNR: plant,
          NAME1: plantName,
          FUNCT: nfaType,
          EXTR_TXT: func,
          SUBJECT: subject,
          SCOPE_IMPACT: scope,
          BUDGET_IMPACT: budget ? Number(budget).toFixed(2) : "",
          TIMELINE_IMPACT: timeline ? String(parseInt(timeline, 10)) : "",
          TEXT: plainDesc ? desc : "",
        },
        files,
        sapUser,
        {
          approvers: selectedApprovers.map((a) => ({ designation: a.role, userId: a.userId })),
          check: approverModeCheck(approverMode),
        },
      );
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/public/enfa-create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      const sapMessage =
        findSapMessage(parsed) ||
        (typeof parsed?.error === "string" ? parsed.error : "") ||
        text.trim() ||
        `${res.status} ${res.statusText}`.trim();
      const enfaNo = parsed?.ENFA_NO ? String(parsed.ENFA_NO) : "";
      if (res.ok && String(parsed?.STATUS ?? "").toUpperCase() === "S" && enfaNo) {
        return { ok: true, message: sapMessage };
      }
      return { ok: false, message: sapMessage };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Create Note For Approval"
        subtitle="Provide context, scope and impact — then route to the appropriate approver chain."
        actions={
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => submit(false)} disabled={busy}>
              <Send className="h-4 w-4" /> Submit
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section icon={<Building2 className="h-4 w-4" />} title="Organisation & Type" desc="Master data is sourced from SAP.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company" required>
                <Select value={company} onValueChange={setCompany} disabled={companiesLoading || companies.length === 0}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        companiesLoading
                          ? "Loading companies from SAP…"
                          : companies.length
                            ? "Select company"
                            : "No companies returned by SAP"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} – {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companiesError ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {companiesError}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => setCompanyReload((n) => n + 1)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </Field>
              <Field label="Plant">
                <Select value={plant} onValueChange={setPlant} disabled={!company || plantsLoading || plants.length === 0}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !company
                          ? "Select company first"
                          : plantsLoading
                            ? "Loading plants from SAP…"
                            : plants.length
                              ? "Select plant"
                              : "No plants returned by SAP"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.code} – {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {plantsError ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plantsError}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => setPlantReload((n) => n + 1)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </Field>
              <Field label="Approver Selection" className="md:col-span-2">
                <RadioGroup
                  value={approverMode}
                  onValueChange={(value) => setApproverMode(value as "predefined" | "dynamic")}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
                >
                  <label
                    htmlFor="approver-mode-predefined"
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:text-primary"
                  >
                    <RadioGroupItem value="predefined" id="approver-mode-predefined" />
                    <span>Predefined Approvers</span>
                    <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:block">
                      From the configured Approval Chain
                    </span>
                  </label>
                  <label
                    htmlFor="approver-mode-dynamic"
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:text-primary"
                  >
                    <RadioGroupItem value="dynamic" id="approver-mode-dynamic" />
                    <span>Dynamic Approvers</span>
                    <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:block">
                      Select approvers while creating
                    </span>
                  </label>
                </RadioGroup>
              </Field>
              <Field label="NFA Type" required>
                <Select value={nfaType} onValueChange={setNfaType} disabled={nfaTypesLoading || nfaTypes.length === 0}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        nfaTypesLoading
                          ? "Loading NFA types from SAP…"
                          : nfaTypes.length
                            ? "Select type"
                            : "No NFA types returned by SAP"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {nfaTypes.map((t) => <SelectItem key={t.code} value={t.code}>{nfaTypeDisplayLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {nfaTypesError ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nfaTypesError}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => setNfaTypeReload((n) => n + 1)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </Field>
              <Field label="Function">
                <Select value={func} onValueChange={setFunc} disabled={!nfaType || functionsLoading || functions.length === 0}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !nfaType
                          ? "Select NFA type first"
                          : functionsLoading
                            ? "Loading functions from SAP…"
                            : functions.length
                              ? "Select function"
                              : "No functions returned by SAP"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {functions.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {functionsError ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {functionsError}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => setFunctionReload((n) => n + 1)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </Field>
            </div>
          </Section>


          <Section icon={<FileText className="h-4 w-4" />} title="Note Details" desc="Subject, scope and impact assessment.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Subject" required className="md:col-span-2">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Concise one-line subject" />
              </Field>
              <Field label="Scope Impact" className="md:col-span-2">
                <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="What functional areas are impacted?" />
              </Field>
              <Field label="Budget Impact (Lakhs)">
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Timeline Impact (Days)">
                <Input type="number" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="0" />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="text-sm font-medium">Detailed Description</div>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setDescOpen(true)}>
                  <FileText className="h-3.5 w-3.5" /> Open
                </Button>
              </div>
              <Dialog open={descOpen} onOpenChange={setDescOpen}>
                <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display text-base">Detailed Description</DialogTitle>
                    <DialogDescription className="sr-only">Edit the rich-text Detailed Description.</DialogDescription>
                  </DialogHeader>
                  <RichTextEditor value={desc} onChange={setDesc} minHeight="45vh" />
                  <DialogFooter>
                    <Button type="button" onClick={() => setDescOpen(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-1">
         <div className="space-y-4">

          <Section icon={<Paperclip className="h-4 w-4" />} title="Document Attachments" desc="Upload supporting documents — quotes, drawings, BOMs, photos.">
            <div className="space-y-3">
              <label className={"flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground transition " + (busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50 hover:border-primary/40")}>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div className="font-medium text-foreground">Click to upload or drop files</div>
                <div className="text-[11px]">PDF, images, Office docs · up to 20 MB each</div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                />
              </label>
              {pending.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  No files staged. Attachments upload when you Submit, and appear in the audit trail.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {pending.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">{f.type || "file"} · {(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeFile(i)} disabled={busy}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section icon={<Send className="h-4 w-4" />} title="Approvers" desc="Choose which configured approvers should review this NFA. Order follows the Approval Chain.">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">Approvers</div>
                <div className={`text-xs ${plant && selectedApprovers.length < MIN_CREATE_APPROVERS ? "text-destructive" : "text-muted-foreground"}`}>
                  {plant && nfaType && func
                    ? `${selectedApprovers.length} selected`
                    : "Select a Plant to see the approvers."}
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setApproversOpen(true)}>
                <Users className="h-3.5 w-3.5" /> Open
              </Button>
            </div>
            <div
              className={approversOpen ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}
              onKeyDown={(e) => { if (e.key === "Escape") setApproversOpen(false); }}
            >
              <div className="absolute inset-0 bg-black/80" onClick={() => setApproversOpen(false)} />
              <div role="dialog" aria-modal="true" aria-labelledby="approvers-dialog-title" className="relative z-10 grid w-full max-w-3xl max-h-[92vh] gap-4 overflow-y-auto border bg-background p-6 shadow-lg sm:rounded-lg">
                <div className="flex flex-col space-y-1.5">
                  <h2 id="approvers-dialog-title" className="font-display text-base font-semibold">Approvers</h2>
                  <p className="text-sm text-muted-foreground">Choose which configured approvers should review this NFA. Order follows the Approval Chain.</p>
                </div>
                <ApproverSelector
                  plant={plant}
                  nfaType={nfaTypes.find((t) => t.code === nfaType)?.name ?? nfaType}
                  functionName={functions.find((f) => f.code === func)?.name ?? func}
                  check={approverModeCheck(approverMode)}
                  onChange={setSelectedApprovers}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setApproversOpen(false)}>Done</Button>
                </div>
              </div>
            </div>
          </Section>
         </div>
        </div>
      </div>

    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-start gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">{icon}</div>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold leading-tight">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}