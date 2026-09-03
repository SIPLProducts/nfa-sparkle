# Add user_name to Back To Initiator and Clarification payloads

Mirror the Approve/Reject change for the remaining two approval actions: SAP receives
`{ "INITIATOR": { "user_name": "...", "REFFLD": "...", "Comment": "..." } }` and
`{ "clarification": { "user_name": "...", "REFFLD": "...", "Comment": "..." } }`
with the logged-in user's User ID resolved dynamically — never hardcoded.

## Current state (verified)

- `src/lib/sap-report.server.ts` `callEnfaApprovalAction` already injects the caller's
  `user_name` as the first key of the wrapper's inner object for every action —
  including `back_to_initiator` (wrapper `INITIATOR`) and `clarification`
  (wrapper `clarification`) — even when the saved template lacks the key.
- `src/routes/api/public/enfa-approve.ts` already resolves the caller's
  `profiles.username` and passes it for every action, and exposes the exact payload
  via the `x-sap-request` response header (visible in Inspect → Network).
- What is missing: the saved body templates in API Settings for the
  `Back To Intiator` and `Clarification Button` endpoint rows still show only
  `{ REFFLD, Comment }`, so admins don't see/edit the full shape SAP receives.

## Changes

### Migration (API Settings templates)

Idempotently update `sap_endpoint.request_body`:

- Row named `Back To Intiator` →
  `{ "INITIATOR": { "user_name": "", "REFFLD": "", "Comment": "" } }`
- Row named `Clarification Button` →
  `{ "clarification": { "user_name": "", "REFFLD": "", "Comment": "" } }`

Path, method, auth, system and all other fields on both rows stay untouched.

### Code

No code changes required — the runtime already injects the resolved `user_name`
for both actions and the proxy route already passes it. This is verified in
`callEnfaApprovalAction` (lines 1309–1322) and `enfa-approve.ts` (lines 74–79).

## Verification

- Run Back To Initiator and Clarification from the Approvals screen in the preview
  and confirm Inspect → Network shows the payload with `user_name` populated with
  the logged-in user's User ID for both actions.
- API Settings edit screens for both rows display the new 3-key template.

No other functionality, API integration, UI, or behavior changes.
