# Fix missing Initiator and Approval Chain in the DMS PDF

## Root cause
Preview and the PDF sent to DMS gather record details in two different ways.

- **Preview / Print Form** uses the shared preparation step. SAP returns record details only to the initiator, so when an approver opens the form, this step fetches the details on the initiator's behalf. That fills in the Initiator name, Function and Approval Chain.
- **DMS PDF** (built on Reject and Final Approval in the Approvals screen) collects its own data and asks SAP as the approver. SAP returns nothing, so the PDF has an empty Initiator and Function and no Approval Chain grid. The uploaded ENFA 100210 PDF shows exactly this.

## Fix
1. When the Approvals screen builds the DMS PDF, use the same shared preparation step as Preview. The PDF then gets the same Initiator name, Function, Approval Chain and merged comments as Preview.
2. Keep everything else on the DMS path as it is:
   - the approver's own comment is still added
   - the APPROVED watermark still appears on final approval
   - the same company logo is used
   - the PDF and the SAP request it is attached to stay the same
3. If the shared step fails, fall back to the current way of collecting data, so an approval or rejection is never blocked.

## Out of scope
- Preview, Print Form, emails and SAP request formats stay unchanged.
- Other actions (Approve before the final level, Back to Initiator, Clarification) still don't attach a PDF.

## Technical details
- In `src/routes/_authed.approvals.tsx`, inside the `needsActionPdf` branch, call `prepareWebPrintForm(selectedEnfaNo, "approvals", selectedRow)`. Pass its `document` and `comments` to `createApprovalPrintFormPdf`. Keep the existing inline resolution only as a `catch` fallback.
- `createApprovalPrintFormPdf` stays as it is. Its second flow merge is safe because `mergeApprovalFlow` does not create duplicates.
- Add a test asserting that the shared preparation step is the source the DMS PDF uses for Initiator and Approval Chain, with an approver-only (empty) Select response.
- Verify with tests and a type check. A real DMS upload can only be checked on the Quality server.
