# Reject action wired to the SAP APPROVAL API

Wire the Reject button on the Approvals screen to the endpoint already registered as "Reject Button" (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`), with SAP's reply shown as-is.

## API Settings

The row already exists and is used as-is — nothing hardcoded:

- Name: `Reject Button`, Method `PUT`, Auth `Basic`, SAP system "Use active system"
- Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
- Body template: `{ "reject": { "REFFLD": "", "Comment": "" } }` — REFFLD and Comment are filled at runtime from the selected record and the comment dialog; the saved template's wrapper/key names are respected.

Editing this row in Settings changes exactly what the Reject button calls.

## Approvals screen

- Select a record, press **Reject**, enter a comment in the existing SAP-styled dialog, confirm.
- The app sends `{ "reject": { "REFFLD": <selected ENFA no>, "Comment": <comment> } }`.
- SAP's reply is surfaced verbatim: a plain-text reply such as `rejected` appears in the toast; a JSON reply uses its `MESSAGE` / `message`, and `STATUS: "E"` or an HTTP error becomes an error toast.
- After a successful reject the worklist reloads from `Approval Get Data`, so the row disappears exactly as SAP reports it.
- Configuration/connection failures show an inline error toast, not the global app-error popup.
- Back To Initiator / Clarification stay unwired until their payloads are shared.

## Technical notes

- `src/lib/sap-report.server.ts`: generalise `callEnfaApproveAction` into `callEnfaApprovalAction({ action, reffld, comment })`, where `action` is `approve` or `reject`. It resolves the endpoint by exact name (`Approved Button` / `Reject Button`) with a name-pattern fallback, and merges REFFLD/Comment into the saved body template under the matching wrapper key. The existing approve export is kept as a thin wrapper so nothing else breaks.
- `src/routes/api/public/enfa-approve.ts`: accepts an optional `action` field (defaults to `approve`), validated against the allowed list, and keeps the same bearer verification plus `{ ok, message, raw }` 200 soft-fail envelope.
- `src/routes/_authed.approvals.tsx`: `submitAction` handles `approve` and `reject` through the same proxy call, passing the action through and showing SAP's message.
