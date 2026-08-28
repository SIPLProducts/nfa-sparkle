import { createFileRoute } from "@tanstack/react-router";
import { wrapReportPayload } from "@/lib/sap-api-constants";
import { useMemo, useRef, useState } from "react";
import { useScreenState, useScreenMemory } from "@/lib/screen-state";
import { useScreenEntryEffect } from "@/hooks/use-screen-entry-effect";
import { type SapReportFilters, type SapReportRow } from "@/lib/sap-api.functions";
import { supabase } from "@/integrations/supabase/client";
import { NFA_TYPES, PLANTS, FUNCTIONS } from "@/lib/sap/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Download, Play, BarChart3, RotateCcw, Upload, Paperclip, Eye, Pencil } from "lucide-react";
import { useInfiniteVisible } from "@/hooks/use-infinite-visible";
import { RecordAttachmentsDialog, uploadToSap } from "@/components/report/RecordAttachmentsDialog";
import { RecordEditDialog } from "@/components/report/RecordEditDialog";
import { RecordPreviewDialog } from "@/components/report/RecordPreviewDialog";

export const Route = createFileRoute("/_authed/report")({
  head: () => ({
    meta: [
      { title: "E-NFA Report | SAP live report" },
      { name: "description", content: "Filter and export live SAP eNFA approval data across plants, types, functions and approvers." },
      { property: "og:title", content: "E-NFA Report | SAP live report" },
      { property: "og:description", content: "Filter and export live SAP eNFA approval data across plants, types, functions and approvers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Report,
});

const EMPTY: SapReportFilters = {
  plant_from: "", plant_to: "", funct_from: "", funct_to: "", nfano_from: "", nfano_to: "",
  extra_from: "", extra_to: "", dat_from: "", dat_to: "", usrid_from: "", usrid_to: "",
  r_proc: "", r_comp: "", r_reje: "", r_init: "", r_clar: "",
};

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

const BASE_COLS: { key: keyof SapReportRow; label: string }[] = [
  { key: "REFFLD", label: "ENFA Number" },
  { key: "PSPNR", label: "Plant" },
  { key: "NAME1", label: "Plant Name" },
  { key: "FUNCT_TXT", label: "NFA Type" },
  { key: "EXTR_TXT", label: "Function" },
  { key: "SUBJECT", label: "Subject" },
  { key: "INIT_NAME", label: "Initiator" },
  { key: "BEGDA", label: "Creation Date" },
];

function statusTone(s: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("appro")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (v.includes("reje")) return "bg-destructive/10 text-destructive";
  if (v.includes("initiator")) return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  if (v.includes("clari")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (v.includes("proc") || v.includes("pend")) return "bg-accent/10 text-accent";
  return "bg-muted text-muted-foreground";
}

function RangeSelect({
  label, options, from, to, onFrom, onTo,
}: {
  label: string;
  options: { code: string; name: string }[];
  from: string; to: string;
  onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Select value={from} onValueChange={(v) => onFrom(v === "_all" ? "" : v)}>
          <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="From" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any</SelectItem>
            {options.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} – {o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">to</span>
        <Select value={to} onValueChange={(v) => onTo(v === "_all" ? "" : v)}>
          <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="To" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any</SelectItem>
            {options.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} – {o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function RangeInput({
  label, type = "text", from, to, onFrom, onTo, placeholder,
}: {
  label: string; type?: string; from: string; to: string;
  onFrom: (v: string) => void; onTo: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input className="min-w-0 flex-1" type={type} value={from} placeholder={placeholder ? `${placeholder} from` : "From"} onChange={(e) => onFrom(e.target.value)} />
        <span className="text-xs text-muted-foreground">to</span>
        <Input className="min-w-0 flex-1" type={type} value={to} placeholder={placeholder ? `${placeholder} to` : "To"} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

function SingleSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: { code: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v === "_all" ? "" : v)}>
        <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Any" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Any</SelectItem>
          {options.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} – {o.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

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

function Report() {
  const [f, setF] = useScreenState<SapReportFilters>("report.filters", EMPTY);
  const [rows, setRows] = useScreenMemory<SapReportRow[]>("report.rows", []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useScreenMemory<boolean>("report.ran", false);
  const [selected, setSelected] = useScreenState<number | null>("report.selected", null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const selectedRow = useMemo(
    () => (selected != null && selected < rows.length ? rows[selected]! : null),
    [selected, rows],
  );

  function requireSelection(): SapReportRow | null {
    if (!selectedRow) {
      toast.info("Select a record first");
      return null;
    }
    return selectedRow;
  }

  async function onUploadPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    const row = selectedRow;
    if (!list.length || !row?.REFFLD) return;
    setUploading(true);
    try {
      const message = await uploadToSap(row.REFFLD, list);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const set = (k: keyof SapReportFilters) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setPair = (a: keyof SapReportFilters, b: keyof SapReportFilters) => (v: string) =>
    setF((p) => ({ ...p, [a]: v, [b]: v }));
  const flag = (k: "r_proc" | "r_comp" | "r_reje" | "r_init" | "r_clar") => (v: boolean) => setF((p) => ({ ...p, [k]: v ? "X" : "" }));

  async function run(background = false) {
    setBusy(true);
    setError(null);
    if (!background) setSelected(null);
    try {
      // Payload sent to SAP, exactly as SAP expects it (visible in DevTools → Network).
      const payload: Record<string, string> = {};
      for (const k of Object.keys(EMPTY) as (keyof SapReportFilters)[]) {
        payload[k] = (f[k] ?? "").toString().trim();
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";

      const res = await fetch("/api/public/enfa-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(wrapReportPayload(payload)),
      });

      const text = await res.text();
      let parsed: unknown = null;
      let parseFailed = false;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; parseFailed = true; }

      setRan(true);
      if (!res.ok) {
        if (background) return;
        const msg =
          (parsed && typeof parsed === "object" && (parsed as any).error) ||
          `SAP responded with status ${res.headers.get("x-sap-status") || res.status}`;
        setRows([]);
        setError(String(msg));
        toast.error(String(msg));
        return;
      }

      const parsedRows = normaliseRows(parsed);
      setRows(parsedRows);
      if (parseFailed) {
        const msg = "Could not read the SAP response (it was not valid JSON)";
        setError(msg);
        toast.error(msg);
      } else if (parsedRows.length === 0) {
        toast.info("SAP returned no records for these filters");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Report failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Navigating back into this screen refreshes the last-run report in the
  // background: current rows and selection stay visible until fresh data lands.
  useScreenEntryEffect("/report", () => {
    if (ran) void run(true);
  });

  function exportCsv() {
    if (!rows.length) return;
    const cols = [
      ...BASE_COLS.map((c) => c.label),
      ...LEVELS.flatMap((l) => [`Designation${l}`, `Approver${l}`, `Status${l}`]),
      "ENFA Status",
    ];
    const lines = [cols.join(",")];
    for (const r of rows) {
      const vals = [
        ...BASE_COLS.map((c) => r[c.key] ?? ""),
        ...LEVELS.flatMap((l) => [
          r[`ROLE${l}` as keyof SapReportRow] ?? "",
          r[`APPR${l}` as keyof SapReportRow] ?? "",
          r[`STAT${l}` as keyof SapReportRow] ?? "",
        ]),
        r.STATUS_TXT ?? "",
      ];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `enfa-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const { count: visibleCount, setSentinel, hasMore } = useInfiniteVisible(rows.length, 10, 10);
  const visibleRows = rows.slice(0, visibleCount);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          eyebrow="Insights"
          title="E-NFA Report"
          subtitle="Live SAP report — filters are sent to SAP as the request payload."
          actions={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          }
        />


      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground">Filters</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <RangeSelect label="Plant" options={PLANTS} from={f.plant_from} to={f.plant_to} onFrom={set("plant_from")} onTo={set("plant_to")} />
          <SingleSelect label="ENFA Type" options={NFA_TYPES} value={f.funct_from} onChange={setPair("funct_from", "funct_to")} />
          <SingleSelect label="Function" options={FUNCTIONS} value={f.extra_from} onChange={setPair("extra_from", "extra_to")} />
          <RangeInput label="Date range" type="date" from={f.dat_from} to={f.dat_to} onFrom={set("dat_from")} onTo={set("dat_to")} />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status:</span>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.r_proc === "X"} onCheckedChange={(v) => flag("r_proc")(!!v)} /> In Process</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.r_comp === "X"} onCheckedChange={(v) => flag("r_comp")(!!v)} /> Completed</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.r_reje === "X"} onCheckedChange={(v) => flag("r_reje")(!!v)} /> Rejected</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.r_init === "X"} onCheckedChange={(v) => flag("r_init")(!!v)} /> Back to Initiator</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.r_clar === "X"} onCheckedChange={(v) => flag("r_clar")(!!v)} /> Requested Clarification</label>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" onClick={() => setF(EMPTY)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button onClick={() => void run()} disabled={busy} className="flex-1 gap-1.5 sm:flex-none">
              <Play className="h-3.5 w-3.5" /> {busy ? "Running…" : "Execute"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} result{rows.length === 1 ? "" : "s"}
          {selectedRow ? <span className="ml-2 font-mono text-xs text-accent">{selectedRow.REFFLD}</span> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => requireSelection() && uploadRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload File, If Any"}
          </Button>
          <input ref={uploadRef} type="file" multiple className="hidden" onChange={onUploadPick} />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requireSelection() && setDocsOpen(true)}>
            <Paperclip className="h-3.5 w-3.5" /> Attached Docs
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requireSelection() && setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => requireSelection() && setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-card shadow-sm">

        {/* Mobile card list */}
        <div className="mt-2 space-y-2.5 md:hidden">

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {busy ? "Calling SAP…" : error ? error : ran ? "No records returned by SAP." : "Run the report to see results."}
          </div>
        )}
        {visibleRows.map((r, i) => (
          <details key={`${r.REFFLD}-${i}`} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="enfa-record"
                    className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                    checked={selected === i}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => setSelected(i)}
                    aria-label={`Select ${r.REFFLD}`}
                  />
                  <span className="font-mono text-[11px] font-semibold text-accent">{r.REFFLD || "—"}</span>
                </span>
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " + statusTone(r.STATUS_TXT)}>{r.STATUS_TXT || "—"}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{r.SUBJECT}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {r.FUNCT_TXT || "—"} · {r.PSPNR} {r.NAME1 ? `· ${r.NAME1}` : ""} · {r.INIT_NAME || "—"} · {r.BEGDA || "—"}
              </div>
            </summary>
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              <div className="text-[11px] text-muted-foreground">Function: {r.EXTR_TXT || "—"}</div>
              {LEVELS.map((l) => {
                const role = r[`ROLE${l}` as keyof SapReportRow] as string;
                const appr = r[`APPR${l}` as keyof SapReportRow] as string;
                const stat = r[`STAT${l}` as keyof SapReportRow] as string;
                if (!role && !appr && !stat) return null;
                return (
                  <div key={l} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">L{l} · {role || "—"}</span>
                    <span className="truncate">{appr || "—"}</span>
                    <span className={"shrink-0 rounded-full px-1.5 py-px text-[10px] " + statusTone(stat)}>{stat || "—"}</span>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        {hasMore && (
          <div ref={setSentinel} className="py-3 text-center text-[11px] text-muted-foreground">
            Loading more… <span className="text-foreground/60">({visibleCount} of {rows.length})</span>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="mt-2 hidden md:block">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-20 border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-9 px-3 py-2.5" />
              {BASE_COLS.map((c, idx) => (
                <th key={c.key} className={"whitespace-nowrap px-3 py-2.5 font-medium" + (idx === 0 ? " sticky left-0 z-10 bg-muted/50" : "")}>{c.label}</th>
              ))}
              {LEVELS.flatMap((l) => [
                <th key={`r${l}`} className="whitespace-nowrap px-3 py-2.5 font-medium">Designation{l}</th>,
                <th key={`a${l}`} className="whitespace-nowrap px-3 py-2.5 font-medium">Approver{l}</th>,
                <th key={`s${l}`} className="whitespace-nowrap px-3 py-2.5 font-medium">Status{l}</th>,
              ])}
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">ENFA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={BASE_COLS.length + LEVELS.length * 3 + 2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {busy ? "Calling SAP…" : error ? error : ran ? "No records returned by SAP." : "Run the report to see results."}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={`${r.REFFLD}-${i}`}
                className={"cursor-pointer hover:bg-muted/40 " + (selected === i ? "bg-accent/5" : "")}
                onClick={() => setSelected(i)}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="radio"
                    name="enfa-record-desktop"
                    className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                    checked={selected === i}
                    onChange={() => setSelected(i)}
                    aria-label={`Select ${r.REFFLD}`}
                  />
                </td>
                {BASE_COLS.map((c, idx) => (
                  <td
                    key={c.key}
                    className={
                      "px-3 py-2.5 " +
                      (idx === 0
                        ? "sticky left-0 z-10 bg-card font-mono text-xs font-medium text-accent"
                        : c.key === "SUBJECT"
                          ? "max-w-[240px] truncate"
                          : "whitespace-nowrap")
                    }
                    title={c.key === "SUBJECT" ? r.SUBJECT : undefined}
                  >
                    {r[c.key] || "—"}
                  </td>
                ))}
                {LEVELS.flatMap((l) => {
                  const role = r[`ROLE${l}` as keyof SapReportRow] as string;
                  const appr = r[`APPR${l}` as keyof SapReportRow] as string;
                  const stat = r[`STAT${l}` as keyof SapReportRow] as string;
                  return [
                    <td key={`r${l}`} className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{role || "—"}</td>,
                    <td key={`a${l}`} className="whitespace-nowrap px-3 py-2.5 text-xs">{appr || "—"}</td>,
                    <td key={`s${l}`} className="px-3 py-2.5">
                      {stat ? <span className={"inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium " + statusTone(stat)}>{stat}</span> : <span className="text-muted-foreground/40">—</span>}
                    </td>,
                  ];
                })}
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " + statusTone(r.STATUS_TXT)}>{r.STATUS_TXT || "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      <RecordAttachmentsDialog enfaNumber={selectedRow?.REFFLD ?? null} open={docsOpen} onOpenChange={setDocsOpen} />


      <RecordEditDialog row={selectedRow} open={editOpen} onOpenChange={setEditOpen} />

      <RecordPreviewDialog row={selectedRow} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
