# Print Form: editable for Initiator, PDF for Approvers

## What changes

**For the Initiator**

- Opening the Print Form shows the same "Note for Approval" sheet, but the
  Detailed Description band becomes editable in place (same rich editor already
  used on the Create screen: formatted text, tables, pasted Word/Excel/web
  content, images).
- A "Save" action stores the edited description with the record, keyed by the
  eNFA number, so the sheet always reopens with the latest version.
- Header values (NFA No, date, initiator, type, function, subject, scope,
  timeline, budget), Approvals and Comments stay read-only on the sheet.
- Editing is only offered while the record is still with the Initiator
  (draft / sent back / clarification). Once it is in approval or completed the
  sheet is read-only, as today.

**For the Approvers**

- The Print Form opens read-only and adds a "Download PDF" action that produces
  a PDF of this exact sheet, so approvers always see the Initiator's latest
  saved description. Existing Print stays as it is.
- Approve / Reject / Clarification and every existing button behave exactly as
  now.

**Layout**

Unchanged from the reference: logo top-right of the header box, grey
"NOTE FOR APPROVAL" band, field rows, full-width Detailed Description band,
three-per-row approver grid, Comments directly below Approvals, same fonts,
spacing and A4 print behaviour. The editable band uses the same typography and
borders as the read-only one, so switching modes does not shift the layout.

## Technical notes

- `src/components/document/EnfaDocument.tsx`: new optional
  `editableDescription` + `onDescriptionChange` props. When set, the
  description cell renders `RichTextEditor` (chromeless variant) instead of
  `RichTextView`; everything else is untouched.
- `src/components/document/PrintFormDialog.tsx`: new optional `canEdit`,
  `enfaNumber`, `onSaved` props. In edit mode it keeps local description state,
  shows Save (upsert `sap_record_draft` by `enfa_number`, with
  `detailed_description` and `updated_by`) plus Cancel; in view mode it is
  unchanged. Adds a "Download PDF" button for all callers.
- PDF generation: client-side, rendering `.enfa-print-area` with
  `html2canvas` + `jspdf` (A4, multi-page slicing on the existing
  `break-inside: avoid` blocks). New deps only; no server route, no SAP call.
- Description source of truth for the sheet stays `sap_record_draft`
  (`detailed_description`), already written on Create and Edit; add a read
  helper in `src/lib/print-form-data.ts` (`loadPrintDescription`) so all three
  callers show the saved rich version.
- Callers: `_authed.nfa.new.tsx` (edit mode, uses in-form description),
  `RecordEditDialog.tsx` (edit mode when the record is with the initiator),
  `_authed.approvals.tsx` (view + Download PDF).
- No schema migration required (`sap_record_draft` already has the columns and
  policies). No SAP payload, workflow, API or DMS change.
