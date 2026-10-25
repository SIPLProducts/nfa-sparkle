# E-NFA Report: show all 15 approval levels from SAP's response

## What changes
SAP's Report response now returns 15 approval levels (`ROLE1..15`, `APPR1..15`, `STAT1..15`), but the results table only shows levels 1–6, so levels 7–15 are missing.

- The results table gets Designation / Approver / Status columns for all 15 levels, in SAP order, followed by ENFA Status. The other columns (ENFA Number, Plant, Plant Name, NFA Type, Function, Subject, Initiator, Creation Date) stay the same.
- The mobile card view lists all 15 levels in the approver chain. Empty levels are still shown as "—".
- CSV export includes all 15 levels.
- The column header typo "DESIGNATIONS5" is corrected to "Designation5" if it appears.

The request payload, API call, filters, Edit, Preview, Upload and Attached Docs stay as they are.

## Technical notes
- `src/routes/_authed.report.tsx`: `LEVELS` becomes 1..15. Table headers, cells, empty-state colSpan and CSV all derive from it already.
- `src/lib/sap-api.functions.ts`: extend the `SapReportRow` type with `ROLE7..15 / APPR7..15 / STAT7..15` (type only).
