import { RichTextView } from "@/components/RichTextView";
import { cn } from "@/lib/utils";

export interface EnfaDocumentApprover {
  role: string;
  userId: string;
  name: string;
  status?: string;
  actedDate?: string;
  actedTime?: string;
}

export interface EnfaDocumentComment {
  name: string;
  text: string;
  /** Optional round number; when present, comments are grouped per version. */
  version?: number;
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
  comments?: EnfaDocumentComment[];
  className?: string;
}

function FieldRow({ label, value }: { label: string; value?: string }) {
  return (
    <tr>
      <td className="enfa-cell" colSpan={2}>
        <span className="font-bold">{label}:</span> {value?.trim() ? value : ""}
      </td>
    </tr>
  );
}

/**
 * Print-ready "Note for Approval" sheet, laid out to match the SAP reference
 * form. Header values are supplied by the caller from the record; the Detailed
 * Description is rendered — with its tables, images and formatting — only
 * inside the content band.
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
  comments = [],
  className,
}: EnfaDocumentProps) {
  // Approvers are laid out three per row so the grid stays square like the
  // reference sheet; trailing gaps are filled with empty cells.
  const rows: (EnfaDocumentApprover | null)[][] = [];
  for (let i = 0; i < approvers.length; i += 3) {
    const chunk: (EnfaDocumentApprover | null)[] = approvers.slice(i, i + 3);
    while (chunk.length < 3) chunk.push(null);
    rows.push(chunk);
  }

  // Every approver is listed (name, plus their remark when entered), grouped by
  // round when the caller supplies version numbers — newest version first.
  const shown = comments.filter((c) => (c.name ?? "").trim() || (c.text ?? "").trim());
  const versions = Array.from(
    new Set(shown.map((c) => (typeof c.version === "number" ? c.version : -1))),
  ).sort((a, b) => b - a);

  return (
    <article className={cn("enfa-doc", className)}>
      <table className="enfa-table">
        <tbody>
          <tr>
            <td className="enfa-cell enfa-title-row" colSpan={2}>
              <div className="enfa-company">
                <span>{companyName || ""}</span>
                <img src="/ramky-logo.png" alt="" className="enfa-logo" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="enfa-cell enfa-band" colSpan={2}>NOTE FOR APPROVAL</td>
          </tr>
          <tr>
            <td className="enfa-cell">
              <span className="font-bold">NFA No:</span>{" "}
              {[nfaNo, plantLabel].filter(Boolean).join(" / ")}
            </td>
            <td className="enfa-cell enfa-right">
              <span className="font-bold">Date:</span> {date ?? ""}
            </td>
          </tr>
          <FieldRow label="Initiator" value={initiator} />
          <FieldRow label="NFA Type" value={nfaType} />
          <FieldRow label="Function" value={functionName} />
          <FieldRow label="Sub" value={subject} />
          <FieldRow label="Scope Impact" value={scopeImpact} />
          <FieldRow label="Timeline Impact" value={timelineDays ? `${timelineDays} (Days)` : ""} />
          <FieldRow label="Budget Impact" value={budgetImpact ? `Rs.${budgetImpact} (Lakhs)` : ""} />

          {/* Detailed Description — the only place the description is rendered. */}
          <tr>
            <td className="enfa-cell enfa-doc-content" colSpan={2}>
              {descriptionHtml?.trim() ? (
                <RichTextView html={descriptionHtml} />
              ) : (
                <span>&nbsp;</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {rows.length > 0 && (
        <table className="enfa-table enfa-table-joined">
          <tbody>
            {rows.map((chunk, r) => (
              <tr key={`appr-${r}`}>
                {chunk.map((a, c) => (
                  <td key={`appr-${r}-${c}`} className="enfa-cell enfa-approver">
                    {a ? (
                      <>
                        <div><span className="font-bold">Role:</span> {a.role || ""}</div>
                        <div><span className="font-bold">User id:</span> {a.userId || ""}</div>
                        <div className="enfa-approver-name">{a.name || ""}</div>
                        <div>{a.actedDate || "."}</div>
                        <div className="font-bold">{a.actedTime || "0:00:00"}</div>
                      </>
                    ) : (
                      <span>&nbsp;</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {withComments.length > 0 && (
        <table className="enfa-table enfa-table-joined">
          <tbody>
            <tr>
              <td className="enfa-cell">
                <div className="font-bold">Current Version Comments:</div>
                {withComments.map((c, i) => (
                  <div key={`cmt-${i}`} className="enfa-comment">
                    <span className="font-bold">{c.name || ""}</span>
                    {c.name ? " — " : ""}
                    {c.text}
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </article>
  );
}
