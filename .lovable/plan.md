# Stop the "Awaiting Your Approval" email on NFA creation

## Cause
Right after SAP accepts a new NFA, the create step sends an "approve" email (level 0) to the first approver. That makes it look approved before the initiator has acted.

## Change
- In the create step, remove only that email call.
- Keep everything else in that step: saving the selected approvers and approver mode against the new ENFA number.
- The first approver still gets "Awaiting Your Approval" when the initiator approves, through the existing approve step (unchanged).
- Reject, Back to Initiator, Clarification and final-approval emails stay the same. The email log, SAP requests and payloads stay the same.

## Technical details
- `src/routes/api/public/enfa-create.ts`: delete the `notifyWorkflowAction` / `runWithinBudget` / `logEmailTimeout` block after the `sap_record_draft` upsert. Update the comment.
- No changes to `workflow-mail.server.ts` or `enfa-approve.ts`.
- Production and Quality need a redeploy before this takes effect.
