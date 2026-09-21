# Fix Print Form PDF download

## Confirmed root cause

The Print Form uses `html2canvas` 1.4.1 to capture the document before creating the PDF. That renderer does not support the `oklch(...)` colors used by the application theme, so it throws “Attempting to parse an unsupported color function ‘oklch’” and stops the download.

## Implementation

- Replace the unsupported capture package with its API-compatible maintained renderer that supports modern CSS color functions, including `oklch`.
- Keep the existing Print Form document, data sources, dynamic company logo, approval details, comments, rich-text tables/images, A4 page splitting, filename, and Download PDF button behavior unchanged.
- Add a narrowly scoped fallback around PDF capture so a rendering failure produces a useful download error without affecting Print or DOCX actions.
- Do not change the Approvals workflow, SAP APIs, saved data, permissions, layouts, or any other screen.

## Verification

- Open the Approvals Print Form for the existing record and download its PDF without the `oklch` warning.
- Inspect every generated PDF page visually for complete header details, Detailed Description, tables, images, approval details, comments, correct margins, and clean page breaks.
- Confirm the downloaded file opens successfully and retains the current filename format.
- Run focused tests and type checks, and confirm Print and other existing actions remain available.
