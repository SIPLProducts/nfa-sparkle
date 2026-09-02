# Reject payload updated with user_name

Wire the Reject action to send `{ "reject": { "user_name": "...", "REFFLD": "...", "Comment": "..." } }` — the logged-in user's User ID included dynamically — and surface SAP's plain-text replies ("rejected" / "Note For Approval Can Only Be Rejected By Initiator") correctly.

## API Settings

- The existing `Reject Button` endpoint row is used as-is (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`, Basic auth, active system).
- Its body template is updated to the new shape so admins see/edit exactly what is sent:
  `{ "reject": { "user_name": "", "REFFLD": "", "Comment": "" } }`
- A migration updates the saved `request_body` template for the `Reject Button` row (only the template's inner key list; path, method, credentials untouched).

## Approvals screen

- Select a record → **Reject/Cancel** → enter comment → confirm, unchanged.
- The app now sends `{ "reject": { "user_name": <logged-in User ID>, "REFFLD": <selected ENFA no>, "Comment": <comment> } }` — `user_name` first, resolved dynamically from the signed-in user's profile (never hardcoded).
- The exact URL, method, and this payload remain visible in Inspect → Network via the existing proxy and `x-sap-*` headers.
- SAP's reply is shown verbatim:
  - `"rejected"` → success toast, worklist reloads from Approval Get Data.
  - `"Note For Approval Can Only Be Rejected By Initiator"` → shown as an error toast (plain-text failure replies are detected and flagged `ok:false` instead of showing as success).
- No other actions (Approve, Back To Initiator, Clarification), UI, filters, or behavior change.

## Technical notes

- `src/routes/api/public/enfa-approve.ts`: after verifying the bearer token, look up the caller's `profiles.username` (User ID) and pass it as `user_name` to the action call; request/response envelope unchanged.
- `src/lib/sap-report.server.ts`: `callEnfaApprovalAction` accepts an optional `user_name` and injects it as the first key of the wrapper's inner object (respecting the saved template's key casing); when absent, the template's `user_name` value is kept.
- Plain-text SAP replies that indicate failure (e.g. containing "can only be", "not allowed", "cannot") set `ok:false` so the UI shows an error toast; `"rejected"` and other replies stay success.
- Migration: update `sap_endpoint.request_body` for the row named `Reject Button` to the new 3-key template (idempotent).
