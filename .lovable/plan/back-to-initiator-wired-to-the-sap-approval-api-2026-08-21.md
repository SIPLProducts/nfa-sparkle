# Back To Initiator wired to the SAP APPROVAL API

Wire the Back To Initiator button on the Approvals screen to the endpoint already registered as "Back To Intiator" (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`), with SAP's reply shown as-is.

## API Settings

The row already exists and is used as-is — nothing hardcoded:

- Name: `Back To Intiator`, Method `PUT`, Auth `Basic`, SAP system "Use active system"
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Body template: `{ "INITIATOR": { "REFFLD": "", "Comment": "" } }` — REFFLD and Comment are filled at runtime from the selected record and the comment dialog; the saved template's wrapper and key names are respected.

Editing this row in Settings changes exactly what the button calls.

## Approvals screen

- Select a record, press **Back To Initiator**, enter a comment in the existing dialog, confirm.
- The app sends `{ "INITIATOR": { "REFFLD": <selected ENFA no>, "Comment": <comment> } }`.
- SAP's reply is surfaced verbatim: a plain-text reply such as `Sent back to initiator for processing` appears in the toast; a JSON reply uses its `MESSAGE` / `message`, and `STATUS: "E"` or an HTTP error becomes an error toast.
- After success the worklist reloads from `Approval Get Data`, so the row moves on exactly as SAP reports it.
- Configuration/connection failures show an inline error toast, not the global app-error popup.
- Clarification stays unwired until its payload is shared.

## Technical notes

- `src/lib/sap-report.server.ts`: extend `callEnfaApprovalAction` with a `back_to_initiator` action — exact name `Back To Intiator`, name-pattern fallback matching both "intiator" and "initiator" spellings, wrapper key `INITIATOR` (case-insensitive match against the saved template).
- `src/routes/api/public/enfa-approve.ts`: add `back_to_initiator` to the allowed action list; envelope and auth unchanged.
- `src/routes/_authed.approvals.tsx`: route the `back_to_initiator` dialog action through the same proxy call and show SAP's message.
