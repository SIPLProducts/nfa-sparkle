import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseCompanyF4, parsePlantF4, parseEnfaTypeF4, parseFunctionF4, nfaTypeDisplayLabel } from "@/lib/sap/master";
import type { Option } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { RichTextEditor, htmlToPlainText } from "@/components/RichTextEditor";
import { toast } from "sonner";
import { Send, FileText, Building2, Sparkles, Paperclip, Upload, X, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/_authed/nfa/new")({
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

function NewNfaPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [company, setCompany] = useState("");
  const [plant, setPlant] = useState("");
  const [nfaType, setNfaType] = useState("");
  const [func, setFunc] = useState("");
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [desc, setDesc] = useState("");
  const [approvers, setApprovers] = useState<ApproverDraft[]>([{ level: 1, email: "", designation: "" }]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
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

  function loadSample() {
    // Company must always come from the live SAP F4 list — never a hardcoded code.
    if (companies.length) setCompany(companies[0]!.code);
    if (nfaTypes.length) setNfaType(nfaTypes[0]!.code);
    if (functions.length) setFunc(functions[0]!.code);
    setSubject("Procurement of 250 KVA DG Set for Varthur Phase 2");
    setScope("Civil, Electrical and Project Operations at Varthur site");
    setBudget("42.5");
    setTimeline("60");
    setDesc(
      "<p><strong>Background:</strong> Existing 160 KVA DG set is undersized for Phase 2 load (estimated 210 KVA continuous).</p>" +
        "<p><strong>Proposal:</strong> Procure a new 250 KVA Cummins DG set with AMF panel, acoustic enclosure and 990L fuel tank.</p>" +
        "<p><strong>Alternatives considered:</strong></p>" +
        "<ol><li>Hire on monthly rental — higher 3-year TCO (~1.6x).</li><li>Upgrade existing set — OEM has declared end-of-life.</li></ol>" +
        "<p><strong>Recommendation:</strong> Approve CAPEX of INR 42.5 Lakhs; vendor finalisation via 3-bid process; delivery &amp; commissioning within 60 days.</p>",
    );
    // Use the signed-in user for every level so the sample is end-to-end actionable
    // without provisioning additional approver accounts. Replace with real approvers later.
    const selfEmail = user?.email ?? "demo@nfa.local";
    setApprovers([
      { level: 1, email: selfEmail, designation: "Projects Lead" },
      { level: 2, email: selfEmail, designation: "Head — Finance" },
      { level: 3, email: selfEmail, designation: "Chief Financial Officer" },
    ]);
    toast.success("Sample NFA loaded — review and submit");
  }


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

  async function submit(asDraft: boolean) {
    if (!user) return;
    if (!company || !nfaType || !subject) return toast.error("Company, NFA Type and Subject are required");
    const validApprovers = approvers.filter((a) => a.email.trim());
    setBusy(true);
    try {
      const plantObj = plants.find((p) => p.code === plant);
      // Always create the record in an upload-allowed state; it is promoted to
      // `in_process` only after every staged attachment has been stored.
      const { data: created, error } = await supabase.from("nfa").insert({
        initiator_id: user.id,
        company, plant: plant || null, plant_name: plantObj?.name ?? null,
        project: null, nfa_type: nfaType, function: func || null,
        subject, scope_impact: scope || null,
        budget_impact: budget ? Number(budget) : null,
        timeline_days: timeline ? Number(timeline) : null,
        detailed_description: plainDesc ? desc : null,
        status: "with_initiator",
        current_level: 0,
      }).select().single();
      if (error || !created) throw error;

      if (validApprovers.length) {
        // Resolve approver emails to user ids via profiles
        const emails = validApprovers.map((a) => a.email.trim().toLowerCase());
        const { data: profs } = await supabase.rpc("resolve_users_by_email", { _emails: emails });
        const map = new Map(
          ((profs ?? []) as Array<{ id: string; email: string | null }>).map((p) => [p.email?.toLowerCase(), p.id]),
        );
        const missing = emails.filter((e) => !map.get(e));
        if (missing.length) {
          toast.error(`Approver(s) not found / never signed in: ${missing.join(", ")}`);
          await supabase.from("nfa").delete().eq("id", created.id);
          setBusy(false);
          return;
        }
        const rows = validApprovers.map((a) => ({
          nfa_id: created.id,
          level: a.level,
          approver_id: map.get(a.email.trim().toLowerCase())!,
          designation: a.designation || null,
        }));
        const { error: aerr } = await supabase.from("nfa_approver").insert(rows);
        if (aerr) throw aerr;
      }

      await supabase.from("nfa_audit").insert({
        nfa_id: created.id, actor_id: user.id,
        action: asDraft ? "Created (draft)" : "Submitted for approval",
      });

      // Upload staged attachments while the record still allows storage inserts.
      if (pending.length) {
        const uploaded: string[] = [];
        const failed: string[] = [];
        for (const file of pending) {
          const path = `${created.id}/${Date.now()}-${file.name}`;
          const { error: se } = await supabase.storage.from("nfa-attachments").upload(path, file, { upsert: false });
          if (se) { toast.error(`Upload failed for ${file.name}: ${se.message}`); failed.push(file.name); continue; }
          const { error: ie } = await supabase.from("nfa_attachment").insert({
            nfa_id: created.id, storage_path: path, filename: file.name,
            mime: file.type || null, size: file.size, uploaded_by: user.id,
          });
          if (ie) { toast.error(`Record failed for ${file.name}: ${ie.message}`); failed.push(file.name); continue; }
          uploaded.push(file.name);
        }
        if (uploaded.length) {
          await supabase.from("nfa_audit").insert({
            nfa_id: created.id, actor_id: user.id,
            action: `Attached ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`,
            comment: uploaded.join(", "),
          });
        }
        if (failed.length) {
          toast.error(`Stopped before sending to SAP — ${failed.length} attachment(s) could not be stored.`);
          nav({ to: "/nfa/$id", params: { id: created.id } });
          return;
        }
      }

      if (!asDraft) {
        // Route for approval only on Submit.
        const { error: perr } = await supabase
          .from("nfa")
          .update({ status: "in_process", current_level: 1 })
          .eq("id", created.id);
        if (perr) throw perr;
      }

      if (asDraft) toast.success("Draft saved");

      // Push the record to SAP through the endpoint registered in Admin → SAP API Settings.
      // This runs on Submit so the SAP response is always shown.
      const sap = await submitToSap(created.id, plantObj?.name ?? "");
      if (sap.ok) toast.success(sap.message);
      else toast.error(sap.message);

      nav({ to: "/nfa/$id", params: { id: created.id } });
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

  /** Sends the newly created record to SAP and stores the returned ENFA number. */
  async function submitToSap(nfaId: string, plantName: string): Promise<{ ok: boolean; message: string }> {
    try {
      const files: Array<{ file_name: string; file: string }> = [];
      for (const f of pending) {
        try {
          files.push({ file_name: f.name, file: await toBase64(f) });
        } catch (err) {
          return { ok: false, message: `Could not read ${f.name} for SAP upload: ${(err as Error).message}` };
        }
      }
      // Base64 inflates by ~4/3; keep the whole batch under a size SAP accepts.
      const encodedBytes = files.reduce((n, f) => n + f.file.length, 0);
      if (encodedBytes > 40 * 1024 * 1024) {
        return {
          ok: false,
          message: "Saved locally, but the attachments are too large to send to SAP in one request. Remove some files and try again.",
        };
      }
      // user_name is the logged-in user's User ID (profiles.username) — never hardcoded.
      const sapUser = await resolveMySapUser(user?.id ?? "");
      const payload = {
        create: {
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
          TEXT: plainDesc,
          file: files,
        },
      };
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
      if (!res.ok) {
        return {
          ok: false,
          message: `Saved locally, but SAP submission failed: ${
            parsed?.error || parsed?.MESSAGE || `status ${res.headers.get("x-sap-status") || res.status}`
          }`,
        };
      }
      const enfaNo = parsed?.ENFA_NO ? String(parsed.ENFA_NO) : "";
      if (parsed?.STATUS === "S" && enfaNo) {
        await supabase.from("nfa").update({ enfa_number: enfaNo }).eq("id", nfaId);
        return { ok: true, message: parsed?.MESSAGE || `Submitted successfully with ENFA No ${enfaNo}` };
      }
      return {
        ok: false,
        message: `Saved locally, but SAP did not confirm: ${parsed?.MESSAGE || text.slice(0, 200) || "empty response"}`,
      };
    } catch (e) {
      return { ok: false, message: `Saved locally, but SAP submission failed: ${(e as Error).message}` };
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Create Note For Approval"
        subtitle="Provide context, scope and impact — then route to the appropriate approver chain."
        actions={
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={loadSample} disabled={busy}>
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Load </span>Sample
            </Button>
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

              <Field label="Detailed Description" className="md:col-span-2">
                <RichTextEditor
                  value={desc}
                  onChange={setDesc}
                  minHeight="240px"
                />
                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
                        <Maximize2 className="h-3.5 w-3.5" /> Expand editor
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader><DialogTitle className="font-display">Detailed Description</DialogTitle></DialogHeader>
                      <RichTextEditor value={desc} onChange={setDesc} minHeight="420px" />
                      <DialogFooter><Button>Done</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </Field>
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