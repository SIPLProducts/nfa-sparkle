# Match the Approvals Print Form to Edit

## Confirmed current behavior

- Edit and Approvals already use the same Print Form renderer, so the document layout itself does not need to change.
- Edit supplies its loaded SAP record, selected worklist row, saved rich description, approval levels, and saved comments directly to that renderer.
- Approvals prepares a separate document object from the SAP detail response, the selected approval row, and `sap_record_draft`. This separate preparation is the only area that can omit header values or an approval level before the shared Print Form renders it.
- Comments are loaded from the existing saved NFA approver records. When no saved comment rows exist, the shared Print Form can produce the same Current Version Comments list from the resolved approver names—but only when Approvals supplies a complete approval chain.

## Changes

1. **Make Approvals use Edit-equivalent field resolution**
   - Build every Print Form value from the complete SAP record first, then use the selected Approvals row and existing saved draft as field-specific fallbacks.
   - Preserve Company Name, NFA number and plant, date, initiator, NFA Type, function, subject, scope, timeline, budget, and rich Detailed Description.
   - Treat blank saved values as missing so they cannot replace populated SAP or worklist values.

2. **Restore the complete Approval Chain**
   - Resolve levels 1–6 dynamically from both the full SAP detail and the selected worklist row.
   - Preserve each level’s role, user ID, approver name, status, action date, and action time using the existing SAP field variants.
   - Merge each field independently, so a partial SAP detail response cannot erase a value already present in the worklist.

3. **Restore Comments exactly as in Edit**
   - Continue using the existing saved-comment loader used by Edit.
   - Pass saved comments together with the fully resolved approval chain.
   - If no saved remarks exist, retain the existing Edit-compatible fallback that lists the resolved approver names under Current Version Comments.

4. **Keep the fix isolated**
   - Change only the Approvals Print Form data preparation.
   - Do not alter the shared document layout, Edit screen, SAP APIs or payloads, approval actions, permissions, attachments, DOCX/PDF behavior, or any other workflow.
   - Do not hardcode record numbers, approvers, comments, or field values.

## Verification

- Compare the same NFA in Edit and Approvals and confirm all header fields, rich text, tables, images, Approval Chain entries, and Comments match.
- Check both records with saved remarks and SAP-only records that rely on approver-name fallback comments.
- Confirm the Approvals PDF contains the same complete document.
- Regression-check Preview, Attached Docs, Approve, Reject, Back to Initiator, and Clarification.

## Technical scope

The functional change is limited to `src/routes/_authed.approvals.tsx`. The existing `PrintFormDialog`, shared document renderer, saved-comment loader, APIs, and database structure remain unchanged.
