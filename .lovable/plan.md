# Remove "0:00:00" and "." placeholders from Approval Chain dates

In the Print Form Approval Chain boxes, each approver shows a date line and a time line. When SAP sends no time (or a zero time like 00:00:00 / 000000), the form prints "0:00:00"; when no date, it prints ".".

## Change
- `src/components/document/EnfaDocument.tsx` only:
  - Add `formatApproverTime`: returns empty for blank or all-zero times; otherwise formats HHMMSS / HH:MM:SS as HH:MM:SS.
  - Date line: show `formatApproverDate` result (DD.MM.YYYY) or nothing — drop the "." placeholder.
  - Time line: render only when a real time exists — drop the "0:00:00" fallback.
- Applies to Preview, printing and PDF (shared document). No payload, parser, or workflow changes.
- Add a small test for the date/time formatters.
