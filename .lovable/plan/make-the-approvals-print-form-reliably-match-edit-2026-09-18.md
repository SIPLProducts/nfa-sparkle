# Make the Approvals Print Form reliably match Edit

## Confirmed findings

- The previous Approvals changes are present in the active source, and the preview reloaded them successfully.
- eNFA `100122` has the complete saved rich description, including its table and two embedded images, plus a versioned working DOCX.
- It has no matching local NFA/approver rows, so the Comments loader cannot supply approval names or remarks from the local workflow tables.
- The Approvals Print Form still assembles its own document and depends on the live SAP detail/worklist response for header and approval-chain values. Recent logs show the SAP approval request failing, so repeated alias and fallback changes cannot guarantee parity.
- Edit and Approvals share the final document renderer; the remaining defect is the separate, unreliable document-data preparation before the renderer opens.

## Changes

1. **Create one shared Print Form document builder**
   - Move response normalization, nonblank field resolution, approval-level mapping, and comment fallback into one tested helper.
   - Feed it the complete detail response, selected SAP row, saved draft, and saved comments.
   - Preserve the exact rich HTML without rewriting tables, images, formatting, or alignment.

2. **Make Approvals use the same resolved document model as Edit**
   - Replace the duplicated Approvals-only mapping with the shared builder.
   - Resolve Company, Plant, Date, Initiator, NFA Type, Function, Subject, Scope, Timeline, Budget, approval roles, user IDs, names, statuses, dates, times, and comments field-by-field.
   - Treat blank values as missing so a partial response never overwrites saved data.
   - Keep the selected approval row as the authoritative approval-chain fallback when local approver rows do not exist.

3. **Prevent incomplete documents from opening silently**
   - Wait for the saved draft, comments, and both existing detail requests to settle before opening.
   - If required header or approval-chain data is still unavailable, keep the available saved document content and show a clear data-loading warning rather than presenting a misleading blank form.
   - Reset stale Print Form state when another approval record is selected.

4. **Add regression coverage for the actual failure shape**
   - Test nested/stringified SAP responses, partial detail responses, alternate approval aliases, blank-value precedence, no local NFA row, saved rich HTML, and approver-name comment fallback.
   - Verify the resulting Approvals document model matches the Edit document model for the same input.

5. **Verify the rendered result, not only compilation**
   - Open the same eNFA from Edit and Approvals and compare every header field, Detailed Description table/image, approval cell, user ID, and comment.
   - Download the Approver PDF and verify all pages contain only the complete document, without blank or dashboard/sidebar content.
   - Confirm Preview, attachments, Approve, Reject, Back to Initiator, Clarification, and Initiator DOCX behavior remain unchanged.

## Technical scope

The functional change will be limited to Approvals Print Form data preparation and a shared pure document-data helper with focused tests. The existing SAP endpoints, database structure, shared document layout, PDF/DOCX generators, approval workflow, permissions, and unrelated screens will remain unchanged.
