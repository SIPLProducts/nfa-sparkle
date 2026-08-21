# Approvals screen driven by the SAP "Approval Get Data" API

Use the endpoint you already registered in Admin → SAP API Settings and render the Approvals screen entirely from its live response.

## API Settings

The existing row is used as-is (and seeded if missing, so it always exists):

- Name: `Approval Get Data`
- Method: `PUT`
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Body template: `{ "get_data": "" }`
- Module `Common`, Auth `Basic`, SAP system: "Use active system", active.

Host, credentials, headers and query resolve from the saved SAP system — nothing hardcoded. Editing this row in Settings changes exactly what the Approvals screen calls.

## Approvals screen

The worklist is loaded from this endpoint and rendered straight from the SAP response:

- Columns mapped from the response keys: ENFA No (`REFFLD`), Plant (`PSPNR`), Plant Name (`NAME1`), NFA Type (`FUNCT`, falling back to `FUNCT_TXT`), Date (`BEGDA`), Subject (`SUBJECT`), and Status (`STATUS_TXT`) plus the L1–L6 level progress — the last two render only when SAP actually returns those keys, so the current payload shows a clean six-column table.
- No client-side filtering and no hardcoded status/value lists — every record SAP returns is shown.
- Record count, search box, single-row radio selection and the toolbar (Preview, Attached Docs, Approve, Reject, Back To Initiator, Clarification) keep working against the selected `REFFLD`.
- Loading, empty ("SAP returned no records"), and inline error states with a Retry button; a missing/inactive endpoint or an unreachable SAP shows a clear notice pointing to Admin → SAP API Settings instead of the global "app encountered an error" popup.
- Visual design stays as it is today.

## Technical notes

- Migration seeds the `Approval Get Data` row into `sap_endpoint` if absent (guarded against duplicates); an existing row is left untouched.
- `src/lib/sap-report.server.ts`: `callEnfaApproval()` resolves `Approval Get Data` first, then falls back to the existing `%approval%` lookup, and sends the endpoint's saved body template (default `{ "get_data": "" }`).
- `src/routes/api/public/enfa-approval.ts`: return `200` with `{ ok: false, message }` for configuration/upstream failures instead of a 502; real auth failures stay 401.
- `src/routes/_authed.approvals.tsx`: render fields dynamically from the returned rows, drop the approver-side filtering, handle the `ok:false` shape, fetch once per mount.
- Approve / Reject / Back To Initiator / Clarification dialogs stay as they are — they get wired once you share those SAP payloads.
