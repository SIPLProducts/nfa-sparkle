# Fix missing Initiator, Function and Approval Chain on Print Form (eNFA 100189)

## Root cause (confirmed)
- eNFA 100189 was created in SAP and has no saved copy in the portal (no saved record or approver rows), so the Print Form depends fully on SAP.
- The Print Form asks SAP for the record details as the **signed-in approver**. SAP only returns those details to the **initiator** ("Can only be edited by initiator"). The approver's request comes back empty, so Initiator and Function are blank.
- Without the Function, the record's approval flow can't be looked up. The fallback chain search finds several chains for the same project and NFA type, can't choose one, and returns nothing. That is why the "Function, Approval Chain unavailable" warning appears.
- Workflow emails for the same record work (email log: `initiator:sap,chain:sap`), because the server already retries the SAP details request as each portal user until SAP answers with the initiator. The Print Form doesn't do this.

## Fix
1. Add one read-only server step for the Print Form. It asks SAP for the record details as the signed-in user. If SAP refuses, it retries as other active portal users, using the same logic the workflow emails already use. It returns only that record's details, and only to users with Approvals, Report or My NFAs access.
2. Print Form preparation calls this step when its normal details request comes back empty. Initiator, Function, plant and NFA type then come from SAP, and the record-specific approval flow fills in the approver grid.
3. The warning appears only when the data is still missing after this step.

## Not changed
SAP APIs and payloads, Approve/Reject/Back/Clarification, emails, Edit, Preview's SAP PDF branch, permissions for other screens, and stored data.

## Verification
- Unit test: the new step returns the first SAP reply that includes the initiator and skips refusals.
- Signed in as an approver, open Print Form for 100189. Confirm Initiator, Function and the approver grid appear and the warning is gone. Check Preview with an X reply, and Print Form for a record that already showed correctly.
- Run the existing Print Form and email tests.

## Technical details
- Move the candidate-user Select loop out of `resolveWorkflowContext` (`workflow-mail.server.ts`) into a shared helper `selectRecordAsInitiator(enfaNo)` in `sap-report.server.ts`, and have emails use it with no behaviour change.
- Add `getInitiatorRecordDetail` server function (`print-initiator.functions.ts`, `requireSupabaseAuth` + screen permission check) that returns the parsed Select row.
- `prepare-web-print-form.ts`: if `selectDetail` and `editDetail` are both empty, use the server function's result as `selectDetail`. Then let the existing flow lookup run.
