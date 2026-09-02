# Approve payload updated with user_name

Mirror the Reject change for Approve: SAP receives `{ "approve": { "user_name": "...", "REFFLD": "...", "Comment": "..." } }` with the logged-in user's User ID resolved dynamically — never hardcoded.

## API Settings

- The existing `Approved Button` row stays as-is (PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`, Basic auth, active system).
- A migration updates its saved `request_body` template to:
  `{ "approve": { "user_name": "", "REFFLD": "", "Comment": "" } }`
  so admins see/edit exactly what is sent. Path, method, credentials untouched.

## Approvals screen

- Flow unchanged: select a record → Approve → optional comment → confirm.
- The app now sends `{ "approve": { "user_name": <logged-in User ID>, "REFFLD": <selected ENFA no>, "Comment": <comment> } }` — `user_name` first, from the signed-in user's `profiles.username`.
- The full payload is visible in Inspect → Network via the existing `x-sap-*` response headers, exactly like Reject.
- SAP's reply handling (verbatim message, plain-text failure detection, worklist reload) is reused as-is.

## Technical notes

- `src/lib/sap-report.server.ts` — no change needed: `callEnfaApprovalAction` already injects the caller's `user_name` as the first key of any action's inner object and respects the saved template's key casing.
- `src/routes/api/public/enfa-approve.ts` — no change needed: it already resolves `profiles.username` for the caller and passes it for every action, including `approve`.
- Migration: update `sap_endpoint.request_body` for the row named `Approved Button` to the new 3-key template (idempotent).
- Verification: run the Approve flow in the preview and confirm the Network tab shows the payload with `user_name` populated.
