# Approval screen driven by the SAP `get_data` API

Register the approval worklist API in API Settings and render the Approvals screen entirely from its live response.

## API Settings

A new endpoint row, editable like the others in Admin → SAP API Settings:

- Name: `Approval Worklist`
- Method: `PUT`
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Body template: `{ "get_data": "" }`
- Module `Common`, active, same system/credentials as the other eNFA endpoints.

Host, credentials, headers and query all resolve from the saved SAP system — nothing hardcoded. Editing the row in Settings changes what the Approvals screen calls.

## Approval screen

The list is loaded from this endpoint and rendered straight from the SAP response:

- Columns mapped from the response keys: ENFA No (`REFFLD`), Plant (`PSPNR`), Plant Name (`NAME1`), NFA Type (`FUNCT`, falling back to `FUNCT_TXT`), Date (`BEGDA`), Subject (`SUBJECT`), and Status (`STATUS_TXT`) plus level progress (`APPR1..6` / `STAT1..6`) shown only when SAP returns those keys.
- No client-side filtering by user and no hardcoded status list — every record SAP returns for the signed-in session is shown.
- Record count, search box, single-row radio selection, and the existing toolbar (Preview, Attached Docs, Approve, Reject, Back To Initiator, Clarification) keep working against the selected `REFFLD`.
- Loading, empty ("SAP returned no records") and inline error states with a Retry button; a missing or inactive endpoint shows a clear notice pointing to Admin → SAP API Settings instead of the global error popup.
- Visual design stays exactly as it is today.

## Technical notes

- Migration seeds the `Approval Worklist` row into `sap_endpoint` (guarded against duplicates).
- `src/lib/sap-report.server.ts`: `callEnfaApproval()` resolves `Approval Worklist` first, then falls back to the existing `%approval%` lookup, and sends the endpoint's saved body template (default `{ "get_data": "" }`).
- `src/routes/api/public/enfa-approval.ts`: return `200` with `{ ok: false, message }` for configuration/upstream failures instead of a 502, keeping real auth failures as 401.
- `src/routes/_authed.approvals.tsx`: render fields dynamically from the returned rows, drop the approver-side filtering, handle the `ok:false` shape, and fetch once per mount.
- Approve / Reject / Back To Initiator / Clarification dialogs stay as they are — they are wired once you share those SAP payloads.
