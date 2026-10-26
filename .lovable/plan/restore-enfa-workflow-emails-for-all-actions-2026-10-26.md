# Restore ENFA workflow emails for all actions

## What the email history shows (today)
- Approve: emails are still being sent (latest 08:00 UTC, ENFA 100220).
- Submit (Create NFA): no email record at all today — not sent, not failed.
- Reject: no record since 06:47 UTC.
- Clarification / Back to Initiator: no record since 05:56 UTC.

When an email fails, the app normally writes a "failed" record. A complete absence of records means the email step never finished running.

## Root cause
The recent speed fix moved email sending into the background: the server replies to the browser as soon as SAP confirms the action, then sends the email afterwards. On the hosting server, work left running after the reply is finished can be stopped before it completes. The email lookup (reading the initiator and approval chain from SAP) plus sending takes several seconds, so it is often cut off — before it can send or even record a failure. Approve sometimes completes in time, which is why only some Approve emails arrive.

## Fix
1. Make Submit, Approve, Reject, Clarification and Back to Initiator wait for the email step again before replying, so it can never be cut off.
2. Keep actions fast by limiting the email step to a fixed time budget (about 12 seconds) and starting the recipient lookup at the same time as the SAP action (already done for Reject; extend to all actions). If the budget runs out, a "failed" record with the reason is written and the action still succeeds.
3. Use the hosting platform's "keep running after reply" hook when it is available, as an extra safety net.
4. No change to SAP requests, recipients, templates, approval logic or levels.

## Verification
- Run the existing email tests plus a new test that the action reply waits for the email step and logs a failure when the time budget expires.
- Perform each action on a test NFA and confirm one email record per action ("sent") and that the email arrives.

## Technical details
- `src/routes/api/public/enfa-approve.ts` and `enfa-create.ts`: replace `void (...)` fire-and-forget with an awaited `Promise.race([notify, timeout])`; start `resolveWorkflowContext` in parallel with the SAP call for every action and merge with `mergeResolved`.
- On timeout, write an `email_log` row with status `failed` and error "Email step timed out".
- Optionally register the promise with the request context `waitUntil` when present.
- After deployment, update the website on Quality and restart the web process.
