# Create NFA: SAP first, local copy only after SAP success

## What changes for the user
- Pressing Submit sends the NFA to SAP **first**. Nothing is saved in the app before SAP confirms.
- If SAP fails or returns no eNFA number, a red popup shows **only SAP's own message**, with no "Saved locally" text. Nothing is saved, the form stays filled in, and you stay on the Create screen to fix it and try again.
- If SAP succeeds, the app saves its copy exactly as it does today: record, approvers, attachments, history, Detailed Description for the Print Form, and the Word copy. Then it shows SAP's success message and opens the record page.

## Error message rules (nothing hardcoded)
SAP's reply is checked in this order:
1. SAP's `MESSAGE` field, including messages nested inside the reply.
2. SAP's `error` field.
3. The raw text of SAP's reply, for cases like `{}`.
4. The network error text if SAP could not be reached.

## Technical details (`src/routes/_authed.nfa.new.tsx` only)
- Reorder `submit()`: build the SAP payload and call `/api/public/enfa-create` before any `nfa`, `nfa_approver`, `nfa_audit`, storage or `nfa_attachment` writes.
- `submitToSap` no longer receives a local id. It returns `{ ok, message, enfaNo }` and strips every "Saved locally…" prefix.
- On failure: show `toast.error(sapMessage)` through the shared Swal layer, then return. No database writes and no navigation.
- On success: run the existing local inserts with `enfa_number` and `status: "in_process"`, then the attachment uploads, `sap_record_draft` upsert and DOCX generation as today. Errors from these later steps show as warnings and never claim that SAP failed.
- No changes to the payload, server routes, other screens or the database.
