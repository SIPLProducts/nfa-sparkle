import { RichTextView } from "@/components/RichTextView";
import { RichTextEditor } from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";
import { normalizeEnfaDocument } from "@/lib/enfa-document-model";
import { orderedCommentVersions } from "@/lib/print-comment-history";

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
  /** Optional SAP approval level used to pair COMMENTn with the matching approver. */
  level?: number;
}

export interface EnfaDocumentProps {
  companyCode?: string;
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
  editableDescription?: string;
  onDescriptionChange?: (html: string) => void;
  approvers?: EnfaDocumentApprover[];
  comments?: EnfaDocumentComment[];
  logoSrc?: string;
  className?: string;
}

function FieldRow({ label, value }: { label: string; value?: string }) {
  return (
    <tr>
      <td className="enfa-cell enfa-field">
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
  editableDescription,
  onDescriptionChange,
  approvers = [],
  comments = [],
  logoSrc,
  className,
}: EnfaDocumentProps) {
  const normalized = normalizeEnfaDocument({
    companyName, nfaNo, plantLabel, date, initiator, nfaType, functionName,
    subject, scopeImpact, timelineDays, budgetImpact, descriptionHtml,
  });
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
  // When the record has no stored remarks (SAP-only records), the approver
  // names still form the current-version list, exactly like the reference.
  const supplied = comments.filter((c) => (c.name ?? "").trim() || (c.text ?? "").trim());
  const shown: EnfaDocumentComment[] =
    supplied.length > 0
      ? supplied
      : approvers
          .filter((a) => (a.name ?? "").trim())
          .map((a) => ({ name: a.name, text: "" }));
  const versions = orderedCommentVersions(shown);

  return (
    <article className={cn("enfa-doc", className)}>
      <table className="enfa-table">
        <tbody>
          <tr>
            <td className="enfa-cell enfa-title-row">
              <div className="enfa-company">
                 <span>{normalized.companyName}</span>
                {logoSrc ? <img src={logoSrc} alt="" className="enfa-logo" /> : null}
              </div>
            </td>
          </tr>
          <tr>
            <td className="enfa-cell enfa-band">NOTE FOR APPROVAL</td>
          </tr>
          <tr>
            <td className="enfa-cell enfa-field">
              <div className="enfa-line">
                <span>
                  <span className="font-bold">NFA No:</span>{" "}
                   {[normalized.nfaNo, normalized.plantLabel].filter(Boolean).join(" / ")}
                </span>
                <span>
                   <span className="font-bold">Date:</span> {normalized.date}
                </span>
              </div>
            </td>
          </tr>
           <FieldRow label="Initiator" value={normalized.initiator} />
           <FieldRow label="NFA Type" value={normalized.nfaType} />
           <FieldRow label="Function" value={normalized.functionName} />
           <FieldRow label="Sub" value={normalized.subject} />
           <FieldRow label="Scope Impact" value={normalized.scopeImpact} />
           <FieldRow label="Timeline Impact" value={normalized.timelineDays ? `${normalized.timelineDays} (Days)` : ""} />
           <FieldRow label="Budget Impact" value={normalized.budgetImpact ? `Rs.${normalized.budgetImpact} (Lakhs)` : ""} />

          {/* Detailed Description — the only place the description is rendered. */}
          <tr>
            <td className="enfa-cell enfa-doc-content">
              {onDescriptionChange ? (
                <RichTextEditor
                   value={editableDescription ?? normalized.descriptionHtml}
                  onChange={onDescriptionChange}
                  placeholder="Type the detailed description…"
                  minHeight="180px"
                  className="enfa-description-editor"
                />
               ) : normalized.descriptionHtml.trim() ? (
                 <RichTextView html={normalized.descriptionHtml} />
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

      {shown.length > 0 && (
        <table className="enfa-table enfa-table-joined">
          <tbody>
            <tr>
              <td className="enfa-cell enfa-comments">
                {versions.map((v, vi) => (
                  <div
                    key={`ver-${v ?? "current"}`}
                    className={cn("enfa-comment-block", vi === 0 && "enfa-comment-block-first")}
                  >
                    <div className="font-bold">
                      {v === undefined ? "Current Version Comments:" : `Version ${v} Comments:`}
                    </div>
                    {shown
                      .filter((c) => c.version === v)
                      .map((c, i) => (
                        <div key={`cmt-${v ?? "current"}-${i}`} className="enfa-comment">
                          <span className="font-bold">{c.name || ""}</span>
                          {c.name && c.text ? " — " : ""}
                          {c.text}
                        </div>
                      ))}
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
