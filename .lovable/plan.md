# Fix Comments section on the Print Form

## What's wrong
For NFAs created directly in SAP (like 100208), the approvers have a Role and User ID but no portal name. The Comments section labels each remark by name only, so:
- the remark "okay" appears with no User ID in front of it;
- approvers who haven't commented are left out of the list.

The reference PDF lists every approver by User ID (9001, 9002, 9003) under "Current Version Comments".

## Fix
1. Label each SAP comment (COMMENT1, COMMENT2 …) with its approver's name, or their **User ID** when there's no name.
2. Under "Current Version Comments", list every approver in level order with their remark beside their ID when they entered one, e.g. `9001 — okay`, `9002`, `9003`. Older version history stays the same.

This applies to the Print Form, Preview when SAP returns X, Approvals, and the downloaded PDF. SAP requests, payloads and the workflow don't change.

## Technical details
- `src/lib/print-comment-history.ts`: `pairPrintCommentsWithApprovers` falls back to `approver.userId`; `mergeCompletePrintComments` adds a current-version entry for each approver without a comment, sorted by level.
- `src/components/document/EnfaDocument.tsx`: the fallback list uses `name || userId`.
- Test in `print-comment-history.test.ts`: approvers with no names plus COMMENT1="okay" produce `9001 — okay`, `9002`, `9003` in that order.
