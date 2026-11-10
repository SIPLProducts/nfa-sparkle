## Remove the Print button from Preview

In the Preview window (Reports / My NFAs / Approvals), remove the "Print" button shown in the footer — for both the web Print Form and SAP PDF previews.

Unchanged: Download, Open in new tab, Close buttons, the preview layout, and all PDF content (the PDF itself contains no Print button).

### Technical details
- `src/components/report/RecordPreviewDialog.tsx`: delete the Print `<Button>`, the now-unused `printPdf` function, and the `Printer` icon import. Nothing else touched.
