import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextView } from "@/components/RichTextView";
import { PLANTS, COMPANIES } from "@/lib/sap/master";
import type { SapReportRow } from "@/lib/sap-api.functions";
import { Printer } from "lucide-react";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="break-words">{value || "—"}</span>
    </div>
  );
}

export function RecordPreviewDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SapReportRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const enfa = row?.REFFLD ?? "";
  const [draft, setDraft] = useState<{
    scope_impact: string | null;
    budget_impact: number | null;
    timeline_days: number | null;
    detailed_description: string | null;
    subject: string | null;
  } | null>(null);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (!open || !enfa) return;
    let cancelled = false;
    (async () => {
      const [{ data: d }, { count }] = await Promise.all([
        supabase
          .from("sap_record_draft")
          .select("subject, scope_impact, budget_impact, timeline_days, detailed_description")
          .eq("enfa_number", enfa)
          .maybeSingle(),
        supabase.from("sap_attachment").select("id", { count: "exact", head: true }).eq("enfa_number", enfa),
      ]);
      if (cancelled) return;
      setDraft(d ?? null);
      setFileCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [open, enfa]);

  const plant = PLANTS.find((p) => p.code === (row?.PSPNR ?? ""));
  const company = COMPANIES.find((c) => c.code === plant?.company);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Preview · {enfa || "—"}</DialogTitle>
        </DialogHeader>

        <div id="enfa-preview" className="space-y-5">
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-display text-sm font-bold">NFA Details</h3>
            <Row label="ENFA Number" value={enfa} />
            <Row label="Company" value={company ? `${company.code} – ${company.name}` : ""} />
            <Row label="Plant" value={[row?.PSPNR, row?.NAME1].filter(Boolean).join(" – ")} />
            <Row label="NFA Type" value={row?.FUNCT_TXT ?? ""} />
            <Row label="Function" value={row?.EXTR_TXT ?? ""} />
            <Row label="Subject" value={draft?.subject || row?.SUBJECT || ""} />
            <Row label="Initiator" value={row?.INIT_NAME ?? ""} />
            <Row label="Creation Date" value={row?.BEGDA ?? ""} />
            <Row label="Status" value={row?.STATUS_TXT ?? ""} />
            <Row label="Scope Impact" value={draft?.scope_impact ?? ""} />
            <Row label="Budget Impact" value={draft?.budget_impact != null ? String(draft.budget_impact) : ""} />
            <Row label="Timeline Impact" value={draft?.timeline_days != null ? `${draft.timeline_days} days` : ""} />
            <Row label="Attachments" value={`${fileCount} file${fileCount === 1 ? "" : "s"}`} />
          </section>

          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-display text-sm font-bold">Approval Ladder</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Level</th>
                  <th className="py-1.5 font-medium">Designation</th>
                  <th className="py-1.5 font-medium">Approver</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {LEVELS.map((l) => {
                  const role = row?.[`ROLE${l}` as keyof SapReportRow] as string | undefined;
                  const appr = row?.[`APPR${l}` as keyof SapReportRow] as string | undefined;
                  const stat = row?.[`STAT${l}` as keyof SapReportRow] as string | undefined;
                  if (!role && !appr && !stat) return null;
                  return (
                    <tr key={l}>
                      <td className="py-1.5 pr-2">L{l}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{role || "—"}</td>
                      <td className="py-1.5 pr-2">{appr || "—"}</td>
                      <td className="py-1.5">{stat || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {draft?.detailed_description ? (
            <section className="rounded-lg border border-border p-4">
              <h3 className="mb-2 font-display text-sm font-bold">Detailed Description</h3>
              <RichTextView html={draft.detailed_description} />
            </section>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
