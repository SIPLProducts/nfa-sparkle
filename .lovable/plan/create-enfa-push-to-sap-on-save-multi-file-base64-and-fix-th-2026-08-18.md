# Create eNFA — push to SAP on Save, multi-file Base64, and fix the upload error

## What is actually happening

- **Save Draft does not call SAP today.** The record is saved locally as `with_initiator` and the SAP Create ENFA call only runs on *Submit for Approval*. So clicking Save never shows a SAP response or an ENFA number.
- **Submit fails on attachments.** The storage insert policy only allows a file when the parent NFA is `with_initiator`, `clarification` or `rejected`. On Submit the record is inserted as `in_process` **before** the files upload, so each file is rejected with `new row violates row-level security policy`.
- The SAP create payload wrapper already sends the exact `{ create: { CC_code, PSPNR, NAME1, FUNCT, EXTR_TXT, SUBJECT, SCOPE_IMPACT, BUDGET_IMPACT, TIMELINE_IMPACT, TEXT, file: [...] } }` shape as POST to the endpoint registered in API Settings, and reads `STATUS` / `MESSAGE` / `ENFA_NO` back. Files that fail to encode are currently dropped silently.

## Changes

1. **Save pushes to SAP immediately (`src/routes/_authed.nfa.new.tsx`)**
   - On Save, after the local record and attachments are stored, call the same Create ENFA endpoint and show SAP's response right away — success toast with SAP's `MESSAGE` and the returned `ENFA_NO`, or the SAP error text on failure.
   - The record stays in its current state (no approval routing, no status change) — Save still does not submit for approval.
   - Submit for Approval keeps its existing behaviour unchanged.

2. **Fix the attachment RLS error**
   - Reorder Submit: insert the NFA as `with_initiator` / level 0, insert approvers, upload attachments, then flip to `in_process` / level 1 and push to SAP. Files are always written while the record allows uploads.
   - Migration: extend the storage insert policy so the initiator can attach to their own NFA while it is `in_process`, and an assigned approver can attach when acting (reusing the existing `private.is_nfa_approver` helper). This also fixes the same failure on the Approvals screen.

3. **Multi-file Base64 to SAP**
   - Build the `file` array from every staged attachment as `{ file_name, file: <base64 without the data-url prefix> }` — no hardcoded names, no single-file limit.
   - Report a clear error when a file cannot be encoded instead of skipping it, and guard total payload size so an oversized batch fails readably instead of timing out against SAP.

4. **Everything stays config-driven** — path, POST method, auth and SAP system continue to come from Admin → SAP API Settings.

## Notes

No change to form fields, layout, or the Company / Plant / NFA Type / Function F4 integrations.
