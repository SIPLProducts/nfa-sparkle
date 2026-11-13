# Fix version grouping in Print Form comments (Production)

## What the screenshot shows
Comments from two rounds (e.g. "okay sampath" twice, "please clarify", then "okay approved by praddep") are all printed under **Current Version Comments**. Older rounds should appear as **Version 1 Comments**, **Version 2 Comments**, etc.

## Why
The Print Form decides versions only from a field in SAP's comments response named exactly `VER` or `VERSION`. When a row has no such field, it is treated as the current version. Production SAP is returning the rows without that exact field name (or with a different name / blank value), so every round falls into "Current Version". Local and Quality SAP return `VER`, which is why they work. This is not yet confirmed from a live Production response, so step 1 confirms it.

## Steps
1. Confirm: in Admin → SAP API Settings (Production), test the Print Form comments endpoint for this eNFA and check the version field name in the response.
2. Make version reading tolerant: accept `VER`, `VERSION`, `VER_NO`, `VERNO`, `VERS`, `ZVER`, `VERSION_NO` (case/space-insensitive, leading zeros like `"002"` allowed).
3. Fallback when SAP sends several comment rows but none carry a version: treat the last row as current and earlier rows as Version 1, 2, ... in order, so history is never merged into the current section.
4. Same logic flows automatically to Preview, Download and the DMS PDF (they share this parser).
5. Add tests for the new field names and the no-version fallback; existing tests must keep passing.

No payload, API, workflow or business logic changes. Deploy to Production is a normal app pull + deploy (no database migration).

## Technical details
- File: `src/lib/print-comment-history.ts` (`readVersion`, `parseSapPrintComments`).
- Tests: `src/lib/print-comment-history.test.ts`.
