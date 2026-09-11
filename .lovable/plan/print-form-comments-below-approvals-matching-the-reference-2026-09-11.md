# Print Form — Comments below Approvals, matching the reference

## What I checked

The record in your screenshot (100122) has no locally stored approver rows —
records created in SAP are not mirrored into the local approver table. The
Comments block is built only from those local rows, so it renders nothing and
disappears from the sheet. That is why Approvals show but Comments do not.

## What changes

**Comments always appear, right under Approvals**
- The Comments block is built from the approver list already shown on the sheet
  (Role / User id / Name), so every approver is listed by name exactly like the
  reference, even when no remark was typed.
- Where a local remark exists for that record, it is shown beside the name.
- Heading reads "Current Version Comments:", the block sits immediately below
  the approver grid with no gap, and grows with its content — never scrolled,
  clipped or truncated.
- When earlier rounds are stored, they follow as "Version N Comments:" blocks in
  descending order, as in the reference pages.

**Approvals**
- Unchanged in data; three per row, empty cells kept so the grid stays square.

**Logo and lines**
- Logo kept at the reference size, right-aligned in the header, clear on screen
  and on paper.
- Stray internal rules removed: header/field rows keep one clean outer box, the
  approver grid and the comments box join the sheet with no doubled borders,
  and the preview's inner scroll frame no longer draws a second border around
  the sheet.

**Print**
- A4, same proportions as on screen, approver and comment blocks never split
  across pages, whole sheet printed (not just the visible part).

Nothing else changes: Create, Edit, Approve, Reject, Clarification, validation,
attachments, SAP payloads and APIs are untouched.

## Technical notes

- `src/components/document/EnfaDocument.tsx`: when `comments` is empty, derive
  the current-version list from `approvers` (name only); render the comments
  table whenever there is at least one approver or comment. Keep version
  grouping for supplied comments.
- `src/lib/print-form-data.ts`: `loadPrintComments` returns `[]` for SAP-only
  records as today — the fallback lives in the document component so all four
  callers (Create, Edit, Approvals, Preview) benefit without changes.
- `src/styles.css`: tighten `.enfa-table-joined` borders, drop the residual
  double rules on `.enfa-comments`, keep `min-height` on the content band and
  the existing print rules.
- `src/components/document/PrintFormDialog.tsx`: preview wrapper loses its inner
  border so only the sheet's own frame is visible.
- No schema, workflow, SAP payload or API changes.
