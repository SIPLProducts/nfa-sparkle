# Stop the email sent right after creating an NFA

## Why it happens
Once SAP accepts a new NFA, the create step calls the approval email routine, passing it the "approve" action at level 0. That routine treats this like a real approval, so the first approver gets the "Awaiting your approval / Approved at the previous level" email before anyone has approved anything.

## Change
- Remove only that one email call from the create step.
- Keep saving the selected approvers and approver mode after create. Approval emails rely on that saved data later.
- Approve, Reject, Back to Initiator, Clarification and Final Approval emails stay exactly as they are.

## Technical details
- `src/routes/api/public/enfa-create.ts`: delete the `notifyWorkflowAction` / `runWithinBudget` / `logEmailTimeout` block after the `sap_record_draft` upsert. Leave the upsert in place.
- Nothing changes in `workflow-mail.server.ts` or the other action routes.
- Production and Quality need a redeploy.
