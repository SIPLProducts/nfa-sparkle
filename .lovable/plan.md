# Restore Approval Details and Comments in the Approvals Print Form

## Confirmed current behavior

- Reports → Edit and Approvals use the same Print Form renderer, so the document layout does not need to change.
- Edit supplies approval rows directly from its selected saved SAP record and loads comments when the Print Form opens.
- Approvals separately rebuilds the document from detail, select, worklist, and locally saved sources. If that rebuilt approval list is empty, the shared renderer hides both Approval Details and the approver-name fallback Comments section.
- The configured approval-flow request can enrich missing role and User ID values, but it must not replace saved approver names, statuses, dates, times, or remarks.

## Changes

1. **Make Approvals use the same approval-row resolution as Edit**
   - Resolve each approval level independently from the complete detail response, select response, and selected Approvals worklist row.
   - Support the existing saved field variants for role, User ID, approver name, status, action date, and action time.
   - Preserve partially populated levels instead of discarding the entire row.

2. **Merge dynamic approval-flow data without losing saved details**
   - Use the selected Plant, NFA Type, and Function to load the configured approval flow.
   - Fill only missing role/User ID fields from that response while keeping record-specific names and action data from saved sources.
   - Retain the assembled saved approval rows when the API is unavailable.

3. **Restore Comments exactly like Edit**
   - Load existing saved comments for the selected eNFA before displaying the form.
   - Pass those comments together with the complete approval list.
   - When no saved remarks exist, use the shared existing fallback that lists the resolved approver names under Current Version Comments.

4. **Keep the fix isolated**
   - Change only the Approvals Print Form data preparation and any shared approval resolver needed to keep Edit and Approvals consistent.
   - Do not change the document layout, header, Detailed Description, APIs, approval actions, permissions, attachments, Edit behavior, DOCX/PDF behavior, or other screens.
   - Do not hardcode approval values, comments, record numbers, or company data.

## Verification

- Compare the same eNFA in Reports → Edit and Approvals and confirm identical Approval Details and Comments.
- Verify saved remarks, records with approver-name fallback comments, partial approval data, and an unavailable approval-flow API.
- Confirm the Approvals PDF includes the same approval grid and comments.
- Regression-check Header Details, rich Detailed Description, tables, images, dynamic company logo, Approve, Reject, Back to Initiator, and Clarification.

## Technical scope

Reuse one field-by-field approval resolver for the Approvals document input, preserve source priority for record-specific saved data, and keep the existing shared Print Form renderer unchanged.
