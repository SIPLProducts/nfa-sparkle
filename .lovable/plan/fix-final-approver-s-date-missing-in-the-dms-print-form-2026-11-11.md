# Fix: final approver's date missing in the DMS Print Form

## What the screenshots show
- Report Preview (after approval): both boxes dated 11.11.2026 — SAP has the date once the approval is recorded.
- DMS PDF: names and comments are correct, but the last box (prasad sharvi, 9002) has no date.

## Root cause
The DMS PDF is built in the browser **before** the approval is sent to SAP, so SAP's reply never contains the final approver's date at that moment. The previous fix fills today's date into "the box being approved", but it locates that box using:
1. the level computed from the worklist row (first level whose `STATn` is blank), then
2. the signed-in user's SAP User ID.

Both lookups can miss for the final approver: the worklist row can already carry a status text on the current level (pushing the computed level past the last box), and the User ID comparison is an exact string match (fails on leading zeros / padding such as `00009002` vs `9002`). When both miss, the box is returned unchanged — so no date.

## Fix (Print Form preparation only; no payload/API/workflow changes)
In `src/lib/print-comment-history.ts` `stampActingApproverDate`, find the acting box with a safer order:
1. Match by SAP User ID, normalised (trim, case-insensitive, leading zeros ignored).
2. Else match by acting level, but only if that level exists in the chain.
3. Else, for an approve/reject PDF, the first box after the last already-dated box that has no date yet.
Existing SAP dates are never overwritten; non-acting boxes untouched.

In `src/lib/approval-print-pdf.tsx`, apply the same normalised ID match when picking the acting approver's name for the new comment (keeps names consistent).

## Verification
- Extend `src/lib/print-dms-names-dates.test.ts` with the 100270-style chain (1001 dated, 9002 undated):
  - acting level beyond the chain + ID `9002` → 9002 gets today's date.
  - ID padded `00009002` → still stamped.
  - no ID/level match → first undated box after dated ones is stamped.
  - an existing SAP date is never replaced.
- Run the existing print-form/status/comment tests to confirm nothing else changes.
- After deploying to Quality/Production, approve a test NFA and check the DMS file shows the final date.
