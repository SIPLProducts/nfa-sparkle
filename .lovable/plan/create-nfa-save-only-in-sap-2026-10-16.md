# Create NFA: save only in SAP

## What changes for the user
- Pressing Submit sends the NFA, including its attachments, to SAP through the existing Create API. The app keeps no copy of the record, approvers, history or files in its own database or storage.
- If SAP fails or returns no eNFA number, a red popup shows **only SAP's own message**, with no "Saved locally" text. Nothing is saved, the form stays filled in, and you stay on the Create screen.
- A green popup appears only when SAP confirms with STATUS "S" and an eNFA number. It shows SAP's own message. Then the form clears and you go to **Edit NFA**, where SAP's records are listed. Today it opens the app's local record page instead.

## Error message rules (nothing hardcoded)
SAP's reply is checked in this order:
1. SAP's `MESSAGE` field, including messages nested inside the reply.
2. SAP's `error` field.
3. The raw text of SAP's reply, for cases like `{}`.
4. The network error text if SAP could not be reached.

## Side effects you should know about
- **Detailed Description:** today it is sent to SAP blank and kept only in the app, where the web Print Form reads it. To keep it once nothing is stored locally, it will be sent in SAP's existing `TEXT` field. If SAP does not store that field, the description will not show on the web Print Form for new NFAs.
- **Word copy:** the automatic Word copy saved after creation is no longer stored.
- Records that already exist, approval actions, Preview, Edit NFA and every other screen are unchanged.

## Technical details (`src/routes/_authed.nfa.new.tsx` only)
- `submit()` keeps its validation, then calls only `submitToSap()`. The `nfa`, `nfa_approver` and `nfa_audit` inserts and deletes are removed from this flow, along with the `nfa-attachments` storage uploads, the `nfa_attachment` inserts, the `enfa_number` and status updates, the `sap_record_draft` upsert and `saveGeneratedDocx`.
- `submitToSap` builds the same payload, except that `TEXT` now carries the description. It returns `{ ok, message }`, uses the error order above, and never adds "Saved locally" text.
- On success: show `toast.success(SAP MESSAGE)`, reset the form state, then `nav({ to: "/nfa/my" })`. On failure: show `toast.error(SAP message)` and return.
- The server route, the database schema and other screens are not changed.
