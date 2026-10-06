# Add approver email to the Approved button payload

## Goal
When an approver clicks Approve (or Reject / Back to Initiator / Clarification), the request sent to SAP gains a `mail_id` key holding the acting approver's email address — taken dynamically from the logged-in user, never hardcoded. Everything else about the payload and screens stays exactly as it is.

Example result:
```json
{ "approve": { "user_name": "SIPL_QM", "mail_id": "thirunavukkarasu@sharviinfotech.com", "REFFLD": "100136", "Comment": "please check 22007746", "file_path": "", "file": "" } }
```

## Changes

1. **Read the email from the session** — `src/routes/api/public/enfa-approve.ts`
   - The handler already validates the caller's session token and reads their User ID from their profile. It will additionally take the email address from the verified session claims (with the profile record as fallback) and pass it on as `mail_id`.
   - If no email exists for the account, the key is sent empty — the action still works.

2. **Carry the email into the SAP payload** — `src/lib/sap-report.server.ts` (`callEnfaApprovalAction`)
   - Accept the new `mail_id` option and forward it to the payload builder, alongside the existing `user_name`.

3. **Insert the key into the payload** — `src/lib/approval-action-payload.ts` (`buildApprovalActionPayload`)
   - Add a `mailId` input. If the configured body template already contains a `mail_id`-style key (any casing), fill it; otherwise add `mail_id` next to `user_name`. Same case-insensitive matching the existing `user_name`/`REFFLD` logic uses, so it works with any template saved in SAP API Settings.

4. **Tests** — extend `src/lib/approval-action-payload.test.ts`
   - Email is inserted when the template has no `mail_id` key.
   - An existing `mail_id` key in the template is filled, not duplicated.
   - Empty email leaves behavior unchanged for the other keys.

## What does not change
- Endpoint address, method, credentials, and SAP system still come from SAP API Settings.
- `user_name`, `REFFLD`, `Comment`, `file_path`, `file` handling is untouched.
- Reject / Back to Initiator / Clarification get the same treatment through the shared builder; no screen or workflow changes.

## Verification
- Run the payload tests and the build.
- Confirm the outgoing request summary (the `x-sap-request` header the server already returns) shows `mail_id` with the signed-in approver's email.
