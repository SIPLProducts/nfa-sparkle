# Preview in My NFAs driven by the registered "Preview In Edit" API

The Preview endpoint (POST `/e-nfa/enfa_report/create?sap-client=300`, body `{ "PRINT": { "EFNA_NO": "" } }`, base64 response) is already registered twice in Admin -> SAP API Settings: **Preview Button** (used by the E-NFA Report screen) and the new **Preview In Edit** row. Today both screens resolve to "Preview Button", so the new row is ignored.

## What changes for the user

- Selecting a record on **My NFAs** and clicking **Preview** now calls the **Preview In Edit** endpoint exactly as registered (its own host/path/method/headers/query/credentials and body template), with the selected ENFA number substituted into `PRINT.EFNA_NO`.
- The returned base64 document is decoded and rendered page-by-page in the preview dialog, with Open in new tab / Download / Print — the same viewer already used on the Reports screen.
- The Reports screen keeps using **Preview Button**; nothing there changes.
- If "Preview In Edit" is missing or inactive, the dialog falls back to the "Preview Button" row, and only if neither exists does it show a clear "endpoint not registered" message. No values are hardcoded — the ENFA number and every request detail come from the selection and the endpoint row.
- If the selected NFA has no SAP eNFA number yet, the existing "no SAP number" message is shown instead of calling SAP.

## Technical notes

- `src/lib/sap-report.server.ts`: `callEnfaPrint(enfaNo, variant?)` gains an optional variant. `variant = "edit"` resolves `name ilike 'Preview In Edit'` first, then falls back to the existing "Preview Button" / `%preview%`/`%print%` lookup; default behaviour is unchanged. The `PRINT.EFNA_NO` value is written into the row's stored `request_body` template rather than a fixed literal.
- `src/routes/api/public/enfa-print.ts`: accepts an optional `variant` (`"edit"`) in the JSON body and forwards it; auth check, envelope unwrapping and base64 extraction stay as they are.
- `src/components/report/RecordPreviewDialog.tsx`: new optional `endpoint?: "report" | "select"` prop (mirroring `RecordEditDialog`) that sends `variant: "edit"` when set to `select`. Rendering, download, print and the local-summary fallback are untouched.
- `src/routes/_authed.nfa.my.tsx`: passes `endpoint="select"` to `RecordPreviewDialog`.
- No schema changes, no new endpoints, no changes to the Reports screen.
