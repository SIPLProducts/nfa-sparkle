# Restore Approver Data and Comments in Approvals Print Form

## Confirmed issue

The shared Print Form already renders Approver Data and Comments correctly when those values are supplied. The Edit screen passes its selected SAP row’s approval levels directly and loads saved comments through the existing comment loader. The Approvals screen separately rebuilds the approval list while merging full SAP details, saved draft data, and its worklist row. This separate mapping can leave the shared Print Form without a usable approval list, which also removes the fallback Comments section.

For eNFA 100122, the rich saved draft exists, but there is no matching local `nfa` / `nfa_approver` record. Therefore, its Comments section must use the same existing fallback as Edit: dynamically list the resolved SAP approver names when no saved remarks are available.

## Changes

1. **Use one reliable approval-level mapping in Approvals**
   - Resolve levels 1–6 from the selected Approvals worklist row, enriched by the complete SAP record when it supplies additional values.
   - Preserve role, user ID, approver name, status, action date, and action time dynamically.
   - Keep a level when either source contains approver information, so a partial full-record response cannot discard valid worklist approvers.

2. **Restore Comments from existing saved data and fallback behavior**
   - Continue using the existing saved-comment loader used by the Edit Print Form.
   - Pass the resolved Approvals approval list and saved comments together to the existing Print Form.
   - When no local remarks exist, retain the current shared renderer behavior that creates the Current Version Comments list from the resolved approver names.

3. **Limit the change to Approvals Print Form data preparation**
   - Do not change the shared Print Form layout, Edit screen, PDF generation, APIs, database structure, SAP payloads, approval actions, permissions, attachments, or other screens.
   - Do not hardcode approvers, comments, record numbers, or values.

4. **Verification**
   - Open the same eNFA in Edit and Approvals Print Form and compare every approver row and Current Version Comments entry.
   - Verify both saved remarks and SAP-only records with no local remarks.
   - Confirm the Approvals PDF includes the same Approver Data and Comments sections.
   - Regression-check the existing Approve, Reject, Back to Initiator, Clarification, Preview, and attachment actions.

## Technical scope

Only `src/routes/_authed.approvals.tsx` should require a functional change. It will construct each approval level field-by-field from the full SAP detail with the selected worklist row as a per-field fallback, then pass that list and `loadPrintComments(...)` output to the unchanged `PrintFormDialog`.
