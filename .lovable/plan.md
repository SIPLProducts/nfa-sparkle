# Make Print Form PDF identical to Preview PDF

## Confirmed cause

- The uploaded Preview PDF (`ENFA-100068-6.pdf`) is the original two-page A4 document returned by the configured Preview service. It has the reference frame, logo, compact header, approval grid, version-wise comments, DRAFT watermark, and page footer.
- The uploaded Print Form PDF (`ENFA-100122_3.pdf`) is generated separately in the browser as a one-page image-based PDF. Its document structure, font metrics, image sizing, pagination, watermark, and footer are therefore different from Preview.
- Preview already downloads the returned PDF bytes unchanged through `/api/public/enfa-print`, while Print Form currently rebuilds the document with `html2canvas-pro` and `jsPDF`. Styling adjustments alone cannot make those two independent renderers reliably identical.

## Changes

1. **Use the Preview PDF as the Print Form download source**
   - Make **Download PDF** in Print Form request the same configured Preview document used by the Preview dialog for that eNFA number.
   - Preserve the correct screen-specific Preview variant so Reports/Edit/Approvals download the same document their Preview action uses.
   - Download the returned PDF bytes directly, without browser recapture, image slicing, added borders, font substitution, watermark recreation, or footer recreation.

2. **Share one PDF request/download path**
   - Extract the existing authenticated Preview request and PDF decoding into a focused shared helper.
   - Use that helper from both Preview and Print Form so endpoint selection, request payload, filename, errors, and downloaded bytes cannot drift again.
   - Keep all values dynamic from the selected record and configured API Settings; do not add record-specific data, logos, comments, or layout values.

3. **Leave non-PDF behavior unchanged**
   - Keep the on-screen Print Form, editable Detailed Description, DOCX generation/upload, Print action, approval flow, comments loading, Initiator lookup, permissions, and SAP actions unchanged.
   - If the configured Preview service does not return a PDF, show a clear download error rather than silently generating a different-looking document.

## Verification

- Download eNFA 100068 from Preview and Print Form and confirm the PDFs have identical page count, A4 dimensions, and rendered page appearance.
- Repeat with eNFA 100122 and compare every page for logo, header fields, Detailed Description tables/images, approval grid, version-wise comments, spacing, alignment, font, watermark, and footer.
- Confirm the Print Form download contains no dialog/sidebar content, clipping, bitmap-only relayout, duplicated embedded form, or locally added page furniture.
- Confirm Preview download/open, Print, editable DOCX, and all existing approval actions remain unchanged.
- Run focused PDF request tests, document/comment tests, and TypeScript checks; render every downloaded page to images for visual QA.

## Technical scope

- Primary files: `src/components/document/PrintFormDialog.tsx`, `src/components/report/RecordPreviewDialog.tsx`, and a small shared browser-safe PDF request/download helper.
- The existing authenticated `/api/public/enfa-print` route and configured Preview endpoints remain the source of the PDF.
- No database, schema, API Settings, workflow, stored-data, or general application layout changes.
