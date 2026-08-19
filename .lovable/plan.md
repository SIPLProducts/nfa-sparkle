# SAP Preview (PDF) integration for the eNFA Report

The registered "Preview Button" endpoint (POST, `/e-nfa/enfa_report/create?sap-client=300`) returns a base64 document for a given eNFA number. Wire it into API Settings and the Report screen's **Preview** action so the actual SAP document is shown — nothing hardcoded, the endpoint row drives host, path, method, headers, query and credentials.

## What changes for the user

- Selecting a record in the E-NFA Report and clicking **Preview** now fetches the SAP print document for that ENFA number and shows it inline in the dialog.
- The dialog shows a loading state while SAP responds, then renders the returned PDF in a viewer with **Download**, **Print** and **Close**.
- If SAP returns an error, or the Preview endpoint is missing/inactive in API Settings, the dialog shows a clear message and falls back to the existing local summary preview (details + approval ladder) so the button never dead-ends.
- API Settings: the Preview endpoint keeps working as-is; its request body template is pre-filled with the exact payload shape (`{ "PRINT": { "EFNA_NO": "" } }`) so it can be tested from the endpoint detail screen, and the response viewer flags base64/binary bodies instead of dumping raw characters.

## Technical notes

- `src/lib/sap-report.server.ts`: new `callEnfaPrint(enfaNo)`. Resolves the endpoint by name (exact "Preview Button", then `%preview%` / `%print%`, excluding report/create/company/plant/type/function/update rows — same strict pattern already used by `callEnfaCreate`), loads the SAP system + credentials via `credentialsFor`, and posts `{ PRINT: { EFNA_NO: enfaNo } }` using the row's method/headers/query. `maxBytes` raised (~8 MB) so full base64 PDFs are not truncated.
- New public route `src/routes/api/public/enfa-print.ts`, mirroring `enfa-detail.ts`: bearer-token check via `supabase.auth.getClaims`, unwraps the middleware `{ body: ... }` envelope, and returns `{ status, base64, mime, filename, error }`. Tolerates the SAP response being a bare base64 string, `{ PDF | FILE | CONTENT | base64 }`, or an array wrapper — key detection is generic, not a fixed field name.
- `src/components/report/RecordPreviewDialog.tsx`: on open, calls the new route with the selected `REFFLD`; on success renders the decoded PDF via a blob object URL in an `<iframe>` (revoked on close), plus Download/Print. Existing summary rendering stays as the fallback path.
- No schema changes; no changes to the report query, filters, table or other endpoints.
