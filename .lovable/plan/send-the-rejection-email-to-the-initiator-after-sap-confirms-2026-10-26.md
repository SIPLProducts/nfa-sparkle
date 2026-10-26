# Send the rejection email to the initiator after SAP confirms a Reject

## What the checks show
- Your middleware log shows SAP **did confirm** the Reject of ENFA 100218: `SAP STATUS: 200`, reply `"rejected"`. The payload was correct (REFFLD, Comment, PDF).
- The app reads `"rejected"` as success, so the email step should have started.
- But the email log has **no row at all** for that Reject. Approve emails for 100218 and 100219 were logged and sent normally.
- The last earlier Reject row (100217, 06:47) was **skipped: "Initiator could not be read from SAP for this record"**.

## Likely cause (confirmed in step 1)
The email step starts but stops before it writes its log row. The most likely reason is the initiator lookup. The server finds the initiator by asking SAP for the record as each portal user. Once a record is rejected, SAP stops returning it. The lookup then fails or runs too long, and the error is only written to the server console. The Approvals screen sends no initiator ID with the action, so there is no backup.

## Steps
1. **Confirm.** Run the email step for 100218 as a dry run on the server and record where it stops (initiator lookup, chain lookup, or sending).
2. **Find the initiator before rejecting.** For Reject only, look up the initiator while the record is still readable, before the Reject goes to SAP. Use that result for the email after SAP confirms. If it fails, use the saved NFA initiator, then the Approvals row values.
3. **Always log the outcome.** Any error in the email step is written to the email log as "failed" with its reason, so it never disappears silently.
4. **Send once, in the background,** only after SAP confirms. The Reject response is not delayed.
5. **Tests.** Unit tests for: a pre-found initiator used when SAP's lookup fails after rejection, and an error in the email step still producing a log row. Then a real email to the initiator for 100218 through your saved settings.

## Not changing
Approve, Back to Initiator, Clarification, the email design and recipient rules, SAP payloads and endpoints, the Reject PDF, the reply check, and other screens.

## Technical details
- `src/routes/api/public/enfa-approve.ts`: for `reject`, start `resolveWorkflowContext` (with a timeout) before `callEnfaApprovalAction`; pass its initiator into the `notifyWorkflowAction` hint.
- `src/lib/workflow-mail.server.ts`: accept a pre-resolved context; add `get_print_initiator` / saved `nfa` initiator fallback; wrap the whole flow so a thrown error writes a `failed` `email_log` row.
- Tests in `workflow-mail.test.ts`.
