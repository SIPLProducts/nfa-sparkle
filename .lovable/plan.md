# Print Form — match the reference sheet

Layout-only changes to the printable "Note for Approval" sheet. No workflow,
API, SAP payload or data changes.

## What changes

**Header block**
- Company name centred, larger and bold; the Ramky logo sits at the top-right,
  clearly visible and vertically centred, at the reference size.
- The grey "NOTE FOR APPROVAL" band keeps its full-width grey fill and remains
  the only shaded row.

**Lines and spacing**
- The field rows (NFA No / Date, Initiator, NFA Type, Function, Sub, Scope
  Impact, Timeline Impact, Budget Impact) lose their internal horizontal rules
  and the vertical divider between NFA No and Date, exactly as in the
  reference: one clean outer box, no grid lines between fields.
- Date stays right-aligned on the same line as NFA No.
- Row padding increased slightly to the reference rhythm; label in bold,
  value in normal weight, single space after the colon.

**Typography**
- Switch the sheet to the reference's clean sans-serif face at the reference
  size, so labels read as bold headings and values as plain text.

**Detailed Description**
- Unchanged in behaviour: full rich content (text, tables, pasted Word/Excel/
  web content, images) rendered in its own band, growing with the content, no
  clipping, clamped to the sheet width.

**Approvers**
- Three per row grid with full borders (as in the reference's approver block),
  empty cells kept so the grid stays square.

**Comments**
- Always rendered when any approver exists: "Current Version Comments:" then
  one line per approver — bold name followed by their remark. Approvers with
  no remark still appear by name. Earlier rounds follow as
  "Version N Comments:". Nothing truncated or hidden behind a scroll area.

**Print**
- A4, no page breaks inside rows, approver cells or comment lines; dialog
  chrome hidden; inner scroll containers neutralised so the whole sheet prints.

## Technical notes

- `src/styles.css` (`.enfa-doc` block): outer border moved to the table, field
  cells set to `border: 0` with an outer wrapper border; band keeps its own top/
  bottom rules; `font-family` changed to the sans stack; `--enfa` sizes/padding
  tuned; `.enfa-logo` height/max-width raised; approver and comment tables keep
  full cell borders.
- `src/components/document/EnfaDocument.tsx`: NFA No / Date become one cell with
  a right-floated date instead of two bordered cells; field rows get a shared
  `enfa-field` class (no inner rules). Comments block rendered whenever
  approvers/comments exist.
- No changes to `print-form-data.ts` queries, callers, or SAP integration.
