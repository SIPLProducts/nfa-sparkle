# Keep the Detailed Description after creating an NFA

## The problem
The Detailed Description you type on Create NFA (formatting, tables, images) used to be saved in the portal under the new eNFA number. The Print Form then showed it. That saving step was taken out in an earlier change, and the description has now also been taken out of the SAP request. So it is saved nowhere, and the Print Form shows an empty description area (as in 100207).

## What changes
- When SAP accepts a new NFA and returns its number, the portal saves the full description with formatting, tables and images under that number again. The other values on the form are saved with it, as before.
- The Print Form, Preview (when SAP returns X), Approvals and the Edit window show that saved description again, in the same layout they already use.
- If this save fails, the NFA is still created. SAP's success message still appears and the form still clears.

## What stays the same
- The SAP Create request is unchanged. It still has no `text` key.
- The editor, the Open button, approvers, attachments, the form clearing after submit, and all other screens and integrations.
- NFAs created while the save was missing (such as 100207) cannot be filled in automatically. Their description was never stored. Editing them and adding the description again will save it.

## Technical details
- `src/routes/_authed.nfa.new.tsx`, `submitToSap`: inside the existing success branch (`STATUS === "S"` and `ENFA_NO`), and before the return, add a try/catch `supabase.from("sap_record_draft").upsert({ enfa_number, subject, scope_impact, budget_impact, timeline_days, detailed_description: plainDesc ? desc : null, updated_by: user.id })`. This is the same shape the code used before it was removed. Errors are only logged.
- No schema, payload or API changes. Print Form readers already merge `sap_record_draft.detailed_description`.
- Add a small test checking that the Create payload still has no `text` key. One already exists, so this is a check only.
