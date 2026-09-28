# Show “Approved” after final approval

## Change

- Keep the existing Print Form layout, sizing, alignment, data, and approval workflow unchanged.
- Update the PDF status watermark so completed/final-approved Print Forms display **“APPROVED”** in the same position and styling currently used for **“DRAFT.”**
- Keep **“DRAFT”** for records that have not reached final approval.
- When generating the PDF during the final Approve action, explicitly mark that generated copy as approved. This is necessary because the PDF is created immediately before SAP confirms and returns the updated record status.
- Do not apply the Approved status to intermediate approvals, Reject, Clarification, or Back to Initiator.

## Verification

- Add focused checks for draft and final-approved status selection.
- Generate the final-approval PDF and confirm it shows **“APPROVED,”** contains no **“DRAFT”** watermark, and retains the reference layout and all current details.
- Confirm a non-final Print Form still shows **“DRAFT.”**
