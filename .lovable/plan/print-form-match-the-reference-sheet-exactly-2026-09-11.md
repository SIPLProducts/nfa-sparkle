# Print Form — match the reference sheet exactly

## What changes

Layout-only refinements to the Print Form (Create, Edit, Approvals and the
formatted preview) so it matches the reference `ENFA-100068` sheet.

**Logo**
- Rendered at the reference size (about 3x today's height) and pinned to the
  right edge of the header box, vertically centred, with the company name
  centred on the full width so the logo never overlaps the text.
- Print rules keep the logo at full quality on paper (exact colour printing,
  no shrinking).

**Detailed Description**
- The band no longer has a fixed height, so long text, tables and pasted
  images are shown in full instead of being cut off; a minimum height keeps
  short descriptions looking like the reference.
- Pasted content (Word/Excel/web tables, screenshots) is clamped to the sheet
  width so it can never push the header or approver grid out of alignment.

**Approvers**
- Three per row, all borders drawn, empty cells kept so the grid stays square,
  with Role / User id / Name / acted date / time in the reference order and
  the same compact spacing.

**Comments**
- "Current Version Comments:" heading, then one line per approver: the name in
  bold followed by their remark, matching the reference block.
- The band grows with its content — nothing is truncated, hidden behind a
  scroll area, or dropped when there are many approvers. Approvers with no
  remark still appear by name, as in the reference.
- Where the record has earlier rounds stored, they follow as
  "Version N Comments:" blocks in descending order, exactly like the reference.

**Print output**
- A4, same proportions on paper as on screen, rows and approver/comment blocks
  never split across pages, dialog chrome hidden, and the dialog's inner scroll
  container removed for print so the whole sheet prints (currently only the
  visible part is reliably laid out).

Everything else — Create, Edit, Approve, Reject, Clarification, validations,
attachments, SAP payloads and APIs — is untouched.

## Technical notes

- `src/components/document/EnfaDocument.tsx`: comments section reworked to list
  every approver (name + remark), grouped by version when version data exists;
  approver grid and field rows unchanged in structure.
- `src/lib/print-form-data.ts`: `loadPrintComments` returns all approvers for
  the record (not only those with a remark) and includes `level`/version so the
  document can group them; still read-only from `nfa` / `nfa_approver`.
- `src/styles.css` (`.enfa-doc` scale): `.enfa-logo` height raised to the
  reference proportion with `object-fit: contain`; `.enfa-doc-content` switches
  from fixed `height` to `min-height`; `print-color-adjust: exact` added; print
  block extended so `.enfa-comment` / `.enfa-approver` avoid page breaks and
  ancestor `overflow`/`max-height` is neutralised while printing.
- `src/components/document/PrintFormDialog.tsx`: the scroll wrapper gets a
  `print:overflow-visible print:max-h-none` treatment so printing captures the
  entire sheet.
- No API, schema, workflow or SAP payload changes.
