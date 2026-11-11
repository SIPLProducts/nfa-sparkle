# Fix approver date and names in the DMS Print Form

## What's wrong (confirmed in code)
The PDF sent to DMS is built in the Approvals screen *before* SAP records the approval, so:
1. **Last approver's date missing** — SAP has no date yet for the level being approved, so that box is blank. Also, for Dynamic-approver NFAs (blank NFA Type) the PDF skips fetching the SAP approval chain entirely, so names/dates can fall back to saved data only.
2. **User ID in Comments** — the acting approver's comment is added with the SAP user ID (e.g. "9002") as its name. Because a "name" is already filled, it is never swapped for the real approver name.

## Fix (PDF generation only; no payload, API or workflow change)
- When adding the acting approver's comment, pass their User ID and current level instead of a name, so the existing name lookup replaces it with the approver name from the chain (e.g. "prasad sharvi — approved").
- Stamp today's date (DD.MM.YYYY) on the acting approver's level in the PDF when SAP hasn't returned one yet; existing SAP dates are never overwritten.
- Fetch the SAP approval chain for the PDF when plant and (NFA Type or NFA number) are present — same rule already used by Preview — so Dynamic NFAs get all levels, names and dates.
- Any earlier comment whose name is just a User ID matching an approver is also shown with the approver's name.

## Technical details
- `src/lib/approval-print-pdf.tsx`: add `approverId` + `actingLevel` inputs; relax `canLoadApprovalFlow`; fill missing date for acting level after `mergeApprovalFlow`; push comment as `{ name: "", approverId, level, text }`.
- `src/lib/print-comment-history.ts` `pairPrintCommentsWithApprovers`: if a comment's name equals an approver's User ID, replace with that approver's name.
- `src/routes/_authed.approvals.tsx`: pass `approverId: userName` and `actingLevel: currentLevel(selectedRow)` (approverName kept as fallback).
- Tests: comment with User ID resolves to name; acting level gets today's date only when blank.
