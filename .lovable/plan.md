# Connect Approval Chain add/edit/delete to the "Create Approvals" SAP API

## What changes for you
- In User Management → Approval Chain, **Add chain**, **Edit** (add, change, reorder, remove levels) and **Delete** will send to the SAP API you configured as **Create Approvals** (`/e-nfa/enfa_approval/APPROVAL`, PUT, Basic auth).
- The list keeps loading from the existing **Approval Chain** read API, and refreshes after every successful save or delete.
- SAP's own reply is shown as the message (e.g. "Data Inserted Successfully"). If SAP returns TYPE "E", its message is shown and your unsaved edits stay open.
- Nothing is hardcoded: URL, method, credentials, headers and SAP system all come from the Create Approvals settings row.

## Payload sent (exactly your sample format)
`{ "create_user": { pspnr, Funct, EXTR_TXT, BEGDA, endda, DESIG1..7, USERID1..7, LINE_INDEX } }`
- Add: values from the form, LINE_INDEX blank.
- Update: same, with the chain's LINE_INDEX from SAP.
- Delete: same keys, all DESIG/USERID slots blank, with LINE_INDEX of the chain.
- Unused slots are always sent as "".

## Technical details
- Root cause today: saves reuse the read-only "Approval Chain" endpoint (configured GET), so SAP never receives the write correctly.
- `callManageApprovalChain` in `src/lib/sap-report.server.ts`: resolve the active endpoint named "Create Approvals" (exact, case-insensitive) first; fall back to the current lookup only if missing. Use its configured method (default PUT), headers, query, system and credentials.
- Keep `buildApprovalChainPayload` / response parsing in `src/lib/sap-approval-chain.ts`; add a test for the exact sample payload and the "Data Inserted Successfully" response.
- Permissions unchanged: reads need Approvals, writes need User Management.
- No database migration, no changes to Print Form, Approvals, Create NFA or other screens.
- Self-hosted server needs the new web build deployed and the app process restarted afterwards.
