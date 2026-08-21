# Approve action wired to the SAP APPROVAL API

Wire the Approve button on the Approvals screen to the SAP endpoint you registered as "Approved Button" (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`), with the response shown dynamically.

## API Settings

Uses the existing row as-is — nothing hardcoded:

- Name: `Approved Button`, Method: `PUT`, Module `Common`, Auth `Basic`, SAP system: "Use active system"
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Body template: `{ "approve": { "REFFLD": "", "Comment": "" } }` — REFFLD and Comment are filled at runtime from the selected record and the comment dialog. If the row has no body template, the same shape is used as the default.

Editing this row in Settings changes exactly what the Approve button calls.

## Approvals screen

- Select a record, press **Approve**, enter an optional comment in the existing SAP-styled dialog, confirm.
- The app sends `{ "approve": { "REFFLD": <selected ENFA no>, "Comment": <comment> } }`.
- SAP's reply is surfaced verbatim: a plain-text reply such as `Sent for next approval` is shown in the success toast; a JSON reply uses its `MESSAGE` / `message` text, and `STATUS: "E"` (or an HTTP error) is shown as an error toast instead. No status strings are invented locally.
- After a successful approve, the worklist reloads from `Approval Get Data`, so the row disappears or moves on exactly as SAP reports it.
- Failures (endpoint missing/inactive, SAP unreachable) show an inline error toast — not the global "app encountered an error" popup.
- Reject / Back To Initiator / Clarification stay as they are until you share their payloads.

## Technical notes

- `src/lib/sap-report.server.ts`: new `callEnfaApprovalAction({ reffld, comment })` resolving the `Approved Button` endpoint (exact name first, then an `%approve%` fallback), merging `REFFLD` / `Comment` into the saved body template, and reusing host/credentials/headers/query from the SAP system.
- New proxy route `src/routes/api/public/enfa-approve.ts`, bearer-verified like `enfa-approval.ts`, returning `{ ok, message, raw }` with a 200 soft-fail envelope for configuration/upstream errors.
- `src/routes/_authed.approvals.tsx`: `submitAction` calls that route for the `approve` action, shows SAP's message, then reloads the list.
