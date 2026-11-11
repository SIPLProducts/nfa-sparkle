# Show approver name beside each Print Form comment

## What's wrong today
The Comments_in_Printform response (e.g. NFA 100255) sends, per level, `APPRn` (User ID), `NAMEn` (approver name) and `COMMENTn`. The comment reader only looks at `COMMENTn` and an `APPROVERn` field SAP doesn't send, so `NAMEn` and `APPRn` are ignored. The Print Form then shows only "ok / ok" with no name.

## Change
- Read `NAMEn` and `APPRn` for each level alongside `COMMENTn` (keep `APPROVERn` support as before).
- Each comment shows as **Approver Name — comment**, e.g. "thiru sharvi — ok", for every level 1–15 that has a comment.
- If SAP leaves `NAMEn` empty, fall back to the existing name matching from the approval chain (by User ID, then level) — unchanged.
- Same result in Preview, Approvals view and the generated PDFs (they already share one comment list and already render the name in bold before the text).

## Not changed
API request payload, endpoints, versions/history handling, layout, workflow and other Print Form sections.

## Technical details
- `src/lib/print-comment-history.ts` `commentsFromRecord`: map `^NAME(\d+)$` to `name`, and `^(APPR|APPROVER)(\d+)$` to `approverId`. Careful: only applies inside comment rows, so the header plant `NAME1` elsewhere is unaffected.
- Add tests in `print-comment-history.test.ts` using the uploaded 100255 sample (3 comments with names thiru/prasad/yashaswini sharvi; empty slots skipped).
