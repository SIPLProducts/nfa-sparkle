# Fix Comments section on the Print Form

## What's wrong (confirmed in code)
For NFAs created directly in SAP (like 100208), approvers come from SAP with a Role and User ID but no portal name. The Comments section labels each remark with the approver's **name** only, so:
- the remark "okay" shows with no User ID in front of it;
- approvers who haven't commented are left out, because the "list every approver" fallback only runs when there are no comments at all, and it also needs a name.

The reference PDF lists every approver by User ID (9001, 9002, 9003) under "Current Version Comments", with the remark beside the right one.

## Fix
1. When pairing a SAP comment (COMMENT1, COMMENT2 …) with its approval level, label it with the approver's name, or their **User ID** when there is no name.
2. In the current version, list every approver in level order: User ID (or name), then their remark if they entered one, e.g. `9001 — okay`, `9002`, `9003`. Older version history stays as it is.
3. Where the approver has an acted status (Approved / Rejected / Sent back / Clarification), show it next to the ID, e.g. `9001 (Approved) — okay`. Nothing is shown for pending approvers.

Applies everywhere this form is used: Print Form, Preview when SAP returns X, Approvals, and the downloaded PDF. No changes to SAP requests, payloads or workflow.

## Technical details
- `src/lib/print-comment-history.ts`: `pairPrintCommentsWithApprovers` falls back to `approver.userId`; new step in `mergeCompletePrintComments` adds one current-version entry per approver missing a comment, ordered by level.
- `src/components/document/EnfaDocument.tsx`: fallback list uses `name || userId`; optional status suffix from the approver row.
- Add tests in `print-comment-history.test.ts`: SAP-only approvers (no names) with COMMENT1="okay" produce `9001 — okay`, `9002`, `9003` in order.
