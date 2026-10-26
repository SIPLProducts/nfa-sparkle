# Preview Print Form: show the updated Comments API reply correctly

## Confirmed current state
- The Comments API (Comments_in_Printform) now returns a list of versions for one eNFA. Each row has `REFFLD`, `VER`, and `APPROVER1..15` / `COMMENT1..15` (sample: 100221, versions 1–3).
- The current reader takes only the first row, ignores `VER`, and ignores `APPROVERn`. So only version 1 is shown, later versions are lost, and approver IDs from the reply are not used for names.

## Changes
1. Read every row of the reply, not just the first.
2. For each row, map `COMMENTn` with its `APPROVERn` at level n (1–15). Skip slots where the comment is blank.
3. Use `VER`: the highest version is shown as "Current Version Comments", lower versions as "Version N Comments", in the existing comments layout.
4. Approver name: match `APPROVERn` (User ID) to the record's approval levels / portal users; if no name is found, show the User ID; if `APPROVERn` is blank (like level 3 in version 1), keep the current level-based name lookup.
5. Keep existing fallbacks (saved Preview history, saved approver remarks) when the API is unavailable or returns no comments. Old single-row replies keep working.

## Not changed
- The request payload `{ "comment": { "Reffld": ... } }`, endpoint settings, the Approval Flow API, Print Form layout, SAP PDF Preview branch, approvals, emails, permissions.

## Verification
- Unit tests using the uploaded 100221 reply: three versions, correct ordering, blank comments skipped, level 3 without approver ID handled, all 15 slots read, single-object reply still works.
- Run existing comment and Print Form tests.

## Technical details
- `src/lib/print-comment-history.ts`: `parseSapPrintComments` iterates all records, sets `version` (undefined for max VER = current, numeric otherwise), `level`, and a new optional `approverId`; `pairPrintCommentsWithApprovers` matches by `approverId` against approver `userId` before level fallback; `mergePrintCommentSources` drops saved history versions already present from the API.
- Add optional `approverId` to `EnfaDocumentComment` (display-neutral).
- Tests in `src/lib/print-comment-history.test.ts`.
