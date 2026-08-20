# SAP Approval list on the NFA Approvals screen

Register the SAP APPROVAL API in API Settings and drive the Approvals screen entirely from its live response.

## API Settings

Add a new endpoint row (registered like the other SAP endpoints, editable in Admin → SAP API Settings):

- Name: "Approval Report"
- Method: PUT
- Path: `/e-nfa/enfa_approval/APPROVAL` (query `sap-client` comes from the SAP system config)
- Body template: `{ "report": "" }`

Host, credentials, headers and query all resolve from the saved SAP system / endpoint record — nothing hardcoded.

## Approvals screen

The inbox table is rebuilt from the SAP response instead of the app database:

- Columns: eNFA No (REFFLD), Plant (PSPNR), Company (NAME1), NFA Type (FUNCT_TXT), Date (BEGDA), Level progress derived from APPR1..APPR6 / STAT1..STAT6, and Status (STATUS_TXT).
- Level shows "Level X / Y" computed from how many approver slots are filled and how many are already actioned.
- Loading, empty ("SAP returned no approval records") and error states, plus a Refresh button.
- Read-only for now: no Approve / Reject / Clarify buttons on these rows.
- Existing search/pagination behaviour and the current visual style are kept.

## Technical notes

- `callEnfaApproval()` added to `src/lib/sap-report.server.ts`, resolving the endpoint by name (`Approval Report` / `%approval%`, excluding report/create/preview/attachment rows) and posting `{ "report": "" }`.
- New proxy route `src/routes/api/public/enfa-approval.ts` — bearer-token verified, mirrors the existing `enfa-report` route, unwraps any middleware envelope and returns SAP's raw array.
- `src/routes/_authed.approvals.tsx` fetches through that route on mount and renders the returned rows; the row type mirrors `SapReportRow`.
