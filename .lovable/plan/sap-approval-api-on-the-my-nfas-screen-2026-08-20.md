# SAP Approval API on the My NFAs screen

Register the SAP APPROVAL endpoint in API Settings and drive the My NFAs list from its live response.

## API Settings

A new endpoint row, editable like the others in Admin → SAP API Settings:

- Name: "Approval Report"
- Method: PUT
- Path: `/e-nfa/enfa_approval/APPROVAL` (the `sap-client` query comes from the saved SAP system)
- Body template: `{ "report": "" }`

Host, credentials, headers and query all resolve from the saved SAP system / endpoint record — nothing hardcoded.

## My NFAs screen

The list is rebuilt from the SAP response instead of the local database:

- Columns mapped from SAP: ENFA Number (REFFLD), Status (STATUS_TXT), Plant (PSPNR + NAME1), NFA Type (FUNCT_TXT), Subject/Created (BEGDA), and level progress derived from APPR1..APPR6 / STAT1..STAT6.
- The status pill colour is derived from STATUS_TXT text, no fixed status list.
- Record count, search box, radio selection and the existing Upload / Attached Docs / Preview / Edit toolbar keep working, now acting on the SAP row directly (no local-to-SAP row conversion needed).
- Loading, empty ("SAP returned no records") and error states, plus refresh after a successful upload/edit.
- Visual design stays exactly as it is today.

## Technical notes

- `callEnfaApproval()` added to `src/lib/sap-report.server.ts`, resolving the endpoint by name (`Approval Report` / `%approval%`, excluding report/create/preview/attachment/upload rows) and sending `{ "report": "" }`.
- New proxy route `src/routes/api/public/enfa-approval.ts`, bearer-token verified, mirroring `enfa-report.ts`: unwraps any middleware envelope and returns SAP's raw array.
- `src/routes/_authed.nfa.my.tsx` fetches through that route on mount and renders `SapReportRow[]` straight from SAP; the local Supabase query and row-mapping helper are removed from this screen.
