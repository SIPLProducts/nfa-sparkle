# Fix version-wise comments in Print Form Preview

## Cause (confirmed)
SAP returns one row per round: `VER: 0` (first round: thiru, prasad, yashaswini "back to initator") and `VER: 1` (current round: thiru "approve by level1").
The comment reader ignores version `0` (it only accepts numbers above 0). So round 0 is treated as "current" and merged with round 1 under a single "Current Version Comments" heading. The API response you pasted shows this: none of the comments carry a version.

## Fix
- In the comment version reader, accept `VER: 0` as a valid version (one-character change: `> 0` becomes `>= 0`).
- Result for NFA 100275:
  - Current Version Comments: thiru sharvi — approve by level1
  - Version 0 Comments: thiru sharvi, prasad sharvi, yashaswini sharvi
- NFAs with only one round (only `VER: 0`) still show everything under Current Version Comments, as today.

## Unchanged
SAP requests and payloads, approver names, dates, watermark, DMS/PDF logic, workflow.

## Checks
- Add a test using the uploaded 100275 response that expects one current comment and three Version 0 comments, plus a single-round test.
- Run the existing print/comment tests.

## Deploy
Publish, then pull and redeploy Quality/Production as usual. No database changes.
