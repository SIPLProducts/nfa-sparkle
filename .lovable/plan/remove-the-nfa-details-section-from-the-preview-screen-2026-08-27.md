# Remove the NFA Details section from the Preview screen

## What changes

- In the Preview dialog (`src/components/report/RecordPreviewDialog.tsx`), remove only the **NFA Details** section and its enclosing markup.
- Keep the following untouched:
  - PDF/canvas rendering and loading state.
  - "Open in new tab", "Download", "Print", and "Close" actions.
  - Approval Ladder section.
  - Detailed Description section.
  - The local-summary fallback shown when the SAP document is missing or fails.

## Why

The user only wants the NFA Details block removed from the preview modal without affecting any other fields, sections, or existing behavior.

## Implementation note

The NFA Details section is rendered inside a `pdfUrl ? null : (...)` guard, so it appears only when the local summary fallback is shown. The edit removes that `<section>` block and the surrounding fragment while leaving the rest of the fallback and the document viewer intact.
