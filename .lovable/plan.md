# Send the rejection email to the initiator after SAP confirms a Reject

## What the email log shows
- Up to 06:44 today, Reject on ENFA 100217 emailed the initiator (KVVK). But SAP had not actually rejected the record. Those were false successes.
- At 06:47 the Reject was **skipped: "Initiator could not be read from SAP for this record"**.
- Since the empty-reply fix, **no Reject has been logged at all**, while Approve emails (100218, 100219) still go out normally.

## Likely causes (confirmed in step 1)
1. **SAP's real "rejected" reply is being read as "no confirmation".** The new reply check only accepts plain text or an object with MESSAGE/STATUS. If SAP confirms with a list, a different key, or text the error filter catches, no email is started.
2. **The initiator can't be found once the record is rejected.** The server finds the initiator through SAP's record Select. After rejection SAP may stop returning it, and the Approvals screen sends no initiator ID with the action. So nobody gets the email.

## Steps
1. **Confirm.** Reject a test record and capture SAP's exact reply (the PDF is left out of the log) and what the initiator lookup returns. Check the server log for "SAP did not confirm".
2. **Accept SAP's real confirmation.** Extend the reply check to the reply shape SAP actually sends for a successful reject. Empty replies and SAP error texts still count as not confirmed.
3. **Always know the initiator.** Look up the initiator from SAP *before* sending the Reject, while the record is still readable, and pass it to the email step. After that, use the saved NFA initiator and the Approvals row values if the lookup fails.
4. **One email per real rejection.** The email goes out once, in the background, after SAP confirms. It is recorded in the email log as before.
5. **Tests.** Add unit tests for SAP's confirmed reject reply and for "initiator found before reject is used when SAP's lookup fails afterwards". Run the email and reply tests.

## Not changing
Approve, Back to Initiator, Clarification, the email design and recipient rules, SAP payloads and endpoints, the Reject PDF, and other screens.

## Technical details
- `src/lib/sap-action-reply.ts`: handle arrays (first element), alternate keys (`MSG`, `TYPE`, `RETURN`), and keep the empty/error rules.
- `src/routes/api/public/enfa-approve.ts`: for `reject` only, start `resolveWorkflowContext` before `callEnfaApprovalAction` and pass the pre-resolved initiator as the hint to `notifyWorkflowAction`.
- `src/lib/workflow-mail.server.ts`: fall back to the saved `nfa` initiator (`get_print_initiator`) when Select returns nothing.
- Tests in `sap-action-reply.test.ts` and `workflow-mail.test.ts`.
