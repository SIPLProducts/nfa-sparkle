# Fix "new row violates row-level security policy" on attachment upload

## What is actually happening

Confirmed from the storage policies and the create flow:

- The storage insert policy on the `nfa-attachments` bucket only allows a file when the parent NFA is in status `with_initiator`, `clarification` or `rejected`.
- On **Create NFA → Submit for Approval**, the record is inserted with status `in_process` **before** the staged files are uploaded. By the time the upload runs, the NFA is already `in_process`, so the policy rejects the file and you see `Upload failed for <file>.pdf: new row violates row-level security policy`.
- Saving as **Draft** works because the record stays `with_initiator`.

The SAP dropdowns (Company, Plant, NFA Type, Function) are unrelated and are already loading live from SAP — nothing about them changes here.

## The fix

1. **Create screen (`src/routes/_authed.nfa.new.tsx`)** — reorder submit:
   - insert the NFA as `with_initiator` / level 0,
   - insert approvers, upload all staged attachments,
   - then flip the record to `in_process` / level 1 and push to SAP.
   So the files are always written while the NFA is still in an upload-allowed state, and a failed upload can be reported before submission.

2. **Storage policy (migration)** — also allow the initiator to attach files to their own NFA while it is `in_process`, so mid-approval attachments from the initiator no longer 403. Approver-side uploads keep working through the existing approver path.

3. **Approvals screen (`src/routes/_authed.approvals.tsx`)** — the same policy gap blocks an approver attaching a document when acting on an `in_process` NFA. Extend the insert policy to cover approvers assigned to that NFA (reusing the existing `private.is_nfa_approver` helper already used by the read policy).

## Notes

No change to the NFA form fields, layout, or SAP payloads. Only the submit ordering and the storage insert policy change.
