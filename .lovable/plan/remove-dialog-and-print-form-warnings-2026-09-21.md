# Remove Dialog and Print Form Warnings

## Confirmed causes

- The browser warnings come from dialog windows that render a title but no accessibility description. The dialog library reports this every time those windows open.
- The yellow Approvals message is produced when the assembled Print Form reports `Initiator` as missing. The document still opens from saved data, so this is a non-blocking field diagnostic rather than an application failure.

## Changes

1. **Add proper descriptions to affected dialogs**
   - Add concise, screen-reader-only descriptions to the Print Form and every other existing dialog currently missing one: Preview, Edit, Detailed Description, attachments and document previews, approval actions, formatted document, expanded editor, and command/search dialog.
   - Connect each description through the existing dialog component so the browser warning is removed correctly rather than hidden in the console.
   - Keep all visible titles, layouts, buttons, actions, and dialog behavior unchanged.

2. **Correct the Approvals source warning behavior**
   - Keep assembling the Print Form from complete details, Reports data, the Approvals row, and saved draft data as it does now.
   - Continue showing a warning when a complete document section or all complete-detail sources are genuinely unavailable.
   - Do not show the yellow warning solely because the optional Initiator display value is absent; leave that field blank when no existing source supplies it.
   - Do not invent or hardcode an Initiator value.

3. **Verify without changing functionality**
   - Open the Approvals Print Form, Preview, Edit, Detailed Description, attachments, document preview, and approval-action dialogs and confirm no missing-description warnings appear.
   - Confirm eNFA 100122 opens without the non-blocking Initiator warning while retaining its header, Detailed Description, Approval Details, Comments, logo, PDF, and Print controls.
   - Run type checks and focused tests, and confirm genuine data-loading failures still produce a useful message.

## Technical scope

This is limited to dialog accessibility metadata and Approvals Print Form warning classification. It will not change SAP APIs, saved data, approval logic, permissions, document content, workflow actions, PDF/DOCX generation, or page layouts.
