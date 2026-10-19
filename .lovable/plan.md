# Fix real workflow emails (Approve, Reject, Back to Initiator, Clarification)

## What the email activity log shows
Real actions on ENFA 100185 today:
- 12:21 Approve → recorded as **Final approval**, sent to the initiator (KVVK).
- 12:25 Back to Initiator → **Skipped: no recipient in SAP data** (no initiator at all).

Test emails all succeed, so the mailbox, password and middleware work. The problem is the people the Approvals screen passes along with a real action.

## Likely root cause (to confirm in step 1)
The browser works out the recipients before it sends the action:
- The **initiator** comes from a second SAP lookup made as the approver. When that lookup returns nothing, and the list row has no initiator ID, the initiator list is empty, so Reject, Back to Initiator, Final approval and Clarification have nobody to email.
- The **approver chain** comes from a chain lookup using the row's plant, NFA type and function. When that fails or the row has no approver names, the chain is empty. The app then treats any Approve as the final approval and emails the initiator instead of the next approver. That matches the 100185 Approve.
- The **current level** is guessed from empty status columns in the row, not from who is actually approving.

## Fix
1. **Confirm.** For ENFA 100185, run the same lookups server-side and record what each returns (initiator, chain, level). The fix must explain both log rows above.
2. **Work out recipients on the server, after SAP accepts the action.** Stop relying on what the browser sends:
   - Initiator: the record's Select detail from SAP (initiator User ID), then the saved NFA initiator, then the row values.
   - Chain: the record's SAP approval flow (User IDs for levels 1-7), then saved approvers, then the row values.
   - Current level: the level whose User ID matches the signed-in approver. If none matches, use the row's status guess.
   - Final approval only when the acting level is the last configured level, never when the chain is empty. If the chain can't be read, Approve is logged as "Skipped: approval chain not available" and doesn't email the initiator by mistake.
3. **Clearer log.** Each activity row also records the level and where the initiator and chain came from, so any future skip shows its reason.
4. **Test.** Unit tests for each rule: next approver, final approval, reject, back to initiator, clarification, empty chain, level found from the approver's User ID. Then a dry run on ENFA 100185 plus one real email per action through your saved settings, with the results reported.

## Not changing
SAP payloads and endpoints, approval order, buttons, comments, PDFs, Print Form, email settings, other screens. The approval response still never waits on or fails because of email.

## Technical details
- `src/lib/workflow-mail.server.ts`: new `resolveWorkflowContext({enfaNo, actorUserId, hint})` uses server-side SAP calls (`sap-call.server`, the same Select and approval-flow logic as `enfa-select` / `sap-approval-flow`) plus `get_print_initiator` / saved `nfa_approver` fallbacks. Merges the browser `notify` as the last fallback. `pickRecipients` returns `skipped` when `total === 0` for approve.
- `enfa-approve.ts`: pass the signed-in username to the resolver. Keep the response unchanged.
- `_authed.approvals.tsx`: keep sending `notify` as a hint only. Fix nothing else.
- `email_log`: add nullable `level int` and `source text` columns (migration, also copied to `deployment/Quality/backend/migrations/9600_email_log_context.sql`).
- Extend `workflow-mail.test.ts`.
