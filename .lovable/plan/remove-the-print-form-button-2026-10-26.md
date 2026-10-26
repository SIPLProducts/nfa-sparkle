# Remove the Print Form button

## What changes for you
The **Print Form** button disappears from both places it appears today:
- **Approvals:** the button next to the selected NFA's actions.
- **Edit NFA dialog:** the button in the dialog's footer, used from My NFAs and the E-NFA Report.

## Not changed
- **Preview:** works as today, including its own Print and Download buttons.
- **Approval actions:** Approve, Reject, Back to Initiator and Clarification work as today.
- **PDFs sent to SAP/DMS:** these are still built from the print form layout on Reject and Final Approval.
- **Emails, payloads and every other button:** unchanged.

## Technical details
- `src/routes/_authed.approvals.tsx`: remove the Print Form `<Button>` (around line 506). Leave the `PrintFormDialog` mount and the print-loading state in place but never opened, or remove them only if nothing else uses them. The action-PDF path does not depend on that dialog.
- `src/components/report/RecordEditDialog.tsx`: remove the footer Print Form `<Button>`, its `PrintFormDialog` mount, the `printOpen` state, and imports that are no longer used.
- `PrintFormDialog` and the shared print form code stay, because Preview and the DMS PDFs reuse them.
