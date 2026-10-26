# Show only the approvers SAP returns in Preview / Print Form

## Cause
SAP's approval-flow reply for 100226 has 3 approvers (9002, 1001, 9001). The Print Form then merges this list level-by-level with the other approver list it already built from the saved record, the report row and the worklist row, which still holds the older predefined chain (9001, 9002, 9003, 1001, 1002, 1003, 1004). The merge keeps every level from both lists, so leftover levels show up and some people appear twice.

## Fix
1. When the approval-flow reply returns approvers, use only those levels, in SAP's order. Saved or report data can still fill blank details (name, status, date, time) for a level, but only when the User ID matches. It can never add a level.
2. When the reply is empty or fails, keep the current behaviour (saved or report chain).
3. Comments and the "Current Version Comments" list stay unchanged. Names still come from the matching User ID.
4. The same approver list is used by Preview, Print Form and the approval/reject PDFs.

## Verification
- A new test using the 100226 reply (3 levels) plus a 7-level saved chain checks that exactly 3 approvers come out: 9002, 1001, 9001.
- A test checks that an empty reply still falls back to the saved chain.
- Run the existing print-form and approval-flow tests.

## Technical details
- `src/lib/prepare-web-print-form.ts`: replace `mergeApprovalFlow(resolved…, flow, false)` with a flow-authoritative merge whenever `flow.approvers.length > 0`.
- `src/lib/sap-approval-flow.ts`: add a `restrictToFlow` helper that fills each flow level from the existing approver with the same userId.
