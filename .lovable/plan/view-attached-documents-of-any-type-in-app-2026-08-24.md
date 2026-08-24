# View attached documents of any type in-app

Today the Attached Docs viewer only renders PDFs (canvas via pdf.js) and images. Everything else — Word, Excel, text, CSV — shows "This file type cannot be previewed in the browser." The fix extends the same viewer to render the common office and text formats, with no change to fetching, uploading, downloading, or any other behaviour.

## What changes for the user

- **View** works for:
  - PDF — unchanged canvas rendering.
  - Images (PNG, JPG, GIF, WEBP, BMP, SVG) — unchanged.
  - **Word (.docx)** — the document is converted to formatted HTML and shown in the dialog (headings, lists, tables, bold/italic, embedded images).
  - **Excel / CSV (.xlsx, .xls, .csv)** — rendered as a scrollable table, with a sheet switcher when the workbook has multiple sheets.
  - **Text-like files** (.txt, .json, .xml, .log, .md) — shown as readable monospaced text.
- Legacy **.doc** (old binary Word) still cannot be rendered in the browser; it keeps the existing message plus the Download button, worded so it's clear the file is fine and can be downloaded.
- If a file fails to parse (wrong type from SAP, corrupt content), the viewer shows a short error line and the Download button instead of a blank panel.
- Download, Upload File, the SAP document list, loading/empty/error states and the Reports vs My NFAs endpoint selection all stay exactly as they are.

## Technical notes

- Only `src/components/report/RecordAttachmentsDialog.tsx` changes, plus two client-side dependencies: `mammoth` (docx → HTML) and `xlsx` (workbook → HTML table). Both are dynamically imported inside the viewer so they are not part of the initial bundle.
- `SapDocViewer` gains a small kind resolver: `pdf | image | docx | sheet | text | none`, decided from the MIME already sniffed server-side in `src/routes/api/public/enfa-attachments.ts` and, as a fallback, the filename extension (SAP names like `3000059878 @r0.docx` keep working).
- Sheet rendering uses `XLSX.read(bytes)` and `sheet_to_html`, wrapped in a scroll container with the existing table styling tokens; CSV goes through the same path.
- Docx HTML from mammoth is sanitised before injection (strip `script`/event handlers/`javascript:` URLs) since the content originates from SAP.
- No changes to `src/lib/sap-report.server.ts`, the proxy routes, API Settings, or the My NFAs / Reports screens.
