# Create eNFA — fix attachment upload error and finish multi-file SAP push

## What is actually happening

- The storage insert policy on the attachments bucket only allows a file when the parent NFA is `with_initiator`, `clarification` or `rejected`. On **Submit for Approval** the record is inserted as `in_process` **before** the staged files are uploaded, so every file is rejected with `new row violates row-level security policy`. Save Draft works because the record stays `with_initiator`.
- The SAP Create ENFA push already exists and already sends `{ create: { CC_code, PSPNR, NAME1, FUNCT, EXTR_TXT, SUBJECT, SCOPE_IMPACT, BUDGET_IMPACT, TIMELINE_IMPACT, TEXT, file: [...] } }` as POST to the endpoint registered in API Settings, and stores the returned `ENFA_NO`. What is missing: files that fail to read are silently dropped, and a failed local upload still lets the SAP call run with an incomplete file list.

## Changes

1. **Submit ordering (`src/routes/_authed.nfa.new.tsx`)**
   - Insert the NFA as `with_initiator` / level 0, insert approvers, upload all staged attachments, then flip to `in_process` / level 1 and push to SAP. Files are therefore always written while the record is in an upload-allowed state.
   - If any attachment fails to upload, stop before submission and show the error so nothing is half-submitted.

2. **Storage policy (migration)**
   - Extend the insert policy so the initiator can also attach to their own NFA while it is `in_process`, and so an assigned approver can attach when acting (reusing the existing `private.is_nfa_approver` helper already used by the read policy). This also fixes the same failure on the Approvals screen.

3. **Multi-file Base64 to SAP (`src/routes/_authed.nfa.new.tsx`)**
   - Build the `file` array from every staged attachment, each as `{ file_name, file: <base64 without data-url prefix> }` — no hardcoded names, no limit of one.
   - Surface a clear error when a file cannot be encoded instead of silently skipping it, and guard total payload size so an oversized batch fails with a readable message rather than a SAP timeout.
   - Keep the response handling unchanged: on `STATUS: "S"` store `ENFA_NO` on the record and show SAP's `MESSAGE`.

4. **Endpoint config** — the Create ENFA row stays fully driven by SAP API Settings (path, POST method, auth, SAP system). Nothing is hardcoded in the app.

## Notes

No change to form fields, layout, or the Company / Plant / NFA Type / Function F4 integrations.
