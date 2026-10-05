# Restore complete Approval Print Forms at every level

## Confirmed cause

- The protected Print Form context already loads the full saved approval chain for authorized Approvals users, but it does **not** load each approval row’s saved remark.
- The separate saved-comment fallback still reads approval rows through the signed-in browser session. At later approval levels, row-level access can expose only that approver’s row, so earlier approver comments and names can disappear even though the Initiator sees the complete history.
- The screen preview and approval/rejection PDF currently repeat the same multi-source assembly separately, which makes it possible for their Approval Chain and Comments results to diverge.

## Implementation

1. Extend the existing Approvals-authorized Print Form context to return the complete ordered approval chain together with every saved remark, approver name, role, User ID, status, and action time.
2. Merge comments by approval level from all current sources:
   - keep current SAP comments first when SAP supplies them;
   - retain saved historical/versioned SAP comments;
   - fill only missing current remarks and names from the complete saved approval rows.
3. Pair comments with approvers only after the final approval chain is resolved, so each remark remains attached to the correct level even when SAP returns partial levels.
4. Use one shared resolved Print Form result for both the on-screen Approval Print Form and approval/rejection PDF creation.
5. Keep optional SAP refresh failures non-blocking and preserve the complete saved form when SAP omits fields or is temporarily unavailable.

## Verification

- Add coverage for a later-level approver receiving all approval levels and all saved comments, not only their own row.
- Verify SAP values still take priority and missing SAP values fall back without duplicates or lost remarks.
- Verify sparse approval levels pair comments with the correct approver.
- Verify preview and generated PDFs receive identical Approval Chain and Comments data.
- Run the focused Print Form, comment-history, approval-flow, and PDF tests; confirm the application remains healthy.

No approval actions, SAP payload formats, permissions, users, records, layouts, or other screens will be changed.
