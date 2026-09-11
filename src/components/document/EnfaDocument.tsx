import { RichTextView } from "@/components/RichTextView";
import { cn } from "@/lib/utils";

export interface EnfaDocumentApprover {
  role: string;
  userId: string;
  name: string;
  status?: string;
}

export interface EnfaDocumentProps {
  companyName: string;
  nfaNo: string;
  plantLabel?: string;
  date?: string;
  initiator?: string;
  nfaType?: string;
  functionName?: string;
  subject?: string;
  scopeImpact?: string;
  timelineDays?: string;
  budgetImpact?: string;
  descriptionHtml?: string;
  approvers?: EnfaDocumentApprover[];
  className?: string;
}

function Field({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={cn("flex gap-1.5 px-3 py-1.5 text-[13px]", className)}>
      <span className="shrink-0 font-bold">{label}:</span>
      <span className="min-w-0 break-words">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

/**
 * Print-ready "Note for Approval" sheet. Header values are supplied by the
 * caller from the record; the Detailed Description is rendered — with its
 * tables, images and formatting — only inside the content band.
 */
export function EnfaDocument({
  companyName,
  nfaNo,
  plantLabel,
  date,
  initiator,
  nfaType,
  functionName,
  subject,
  scopeImpact,
  timelineDays,
  budgetImpact,
  descriptionHtml,
  approvers = [],
  className,
}: EnfaDocumentProps) {
  return (
    <article className={cn("enfa-doc bg-white text-slate-900", className)}>
      <header className="flex items-center justify-between gap-4 border border-slate-800 border-b-0 px-3 py-2">
        <h1 className="font-display text-base font-bold">{companyName || "—"}</h1>
        <img src="/ramky-logo.png" alt="" className="h-9 w-auto" />
      </header>

      <div className="border border-slate-800 border-b-0 py-2 text-center">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em]">Note for Approval</h2>
      </div>

      <section className="border border-slate-800 border-b-0">
        <div className="grid grid-cols-1 divide-y divide-slate-300 sm:grid-cols-2 sm:divide-y-0">
          <Field label="NFA No" value={[nfaNo, plantLabel].filter(Boolean).join(" / ")} />
          <Field label="Date" value={date} className="sm:border-l sm:border-slate-300" />
        </div>
        <div className="border-t border-slate-300"><Field label="Initiator" value={initiator} /></div>
        <div className="border-t border-slate-300"><Field label="NFA Type" value={nfaType} /></div>
        <div className="border-t border-slate-300"><Field label="Function" value={functionName} /></div>
        <div className="border-t border-slate-300"><Field label="Sub" value={subject} /></div>
        <div className="border-t border-slate-300"><Field label="Scope Impact" value={scopeImpact} /></div>
        <div className="grid grid-cols-1 border-t border-slate-300 sm:grid-cols-2">
          <Field label="Timeline Impact" value={timelineDays ? `${timelineDays} (Days)` : ""} />
          <Field
            label="Budget Impact"
            value={budgetImpact ? `Rs.${budgetImpact} (Lakhs)` : ""}
            className="sm:border-l sm:border-slate-300"
          />
        </div>
      </section>

      {/* Detailed Description — the only place the description is rendered. */}
      <section className="enfa-doc-content border border-slate-800 px-3 py-3">
        {descriptionHtml?.trim() ? (
          <RichTextView html={descriptionHtml} className="text-[13px]" />
        ) : (
          <p className="text-[13px] text-slate-400">No detailed description entered.</p>
        )}
      </section>

      {approvers.length > 0 && (
        <section className="grid grid-cols-1 border border-slate-800 border-t-0 sm:grid-cols-3">
          {approvers.map((a, i) => (
            <div key={`${a.role}-${i}`} className="border-t border-slate-300 px-3 py-2 text-[12px] sm:border-l sm:border-t-0 sm:first:border-l-0">
              <p><span className="font-bold">Role:</span> {a.role || "—"}</p>
              <p><span className="font-bold">User id:</span> {a.userId || "—"}</p>
              <p>{a.name || "—"}</p>
              {a.status ? <p className="text-slate-500">{a.status}</p> : null}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}
