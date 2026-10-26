# Fix missing Initiator, Function, Approver names and Comments in Preview / Print Form

## What was found (NFA 100225)
- The saved copy of the NFA has the Subject, Scope, Budget, Timeline, Description and the 10 approver slots (User ID + designation) — but **no Initiator and no Function**.
- NFAs created after the move to SAP are not in the portal's old local NFA table, so the old fallback for initiator, function, approver names and saved comments finds nothing.
- Initiator and Function therefore come only from SAP's record read. SAP answers that read only for the initiator, and the portal's "read as initiator" retry needs to know who the initiator is, which it can't find for these records. Result: blank fields.
- Approver names fall back to the User ID because nothing maps SAP User IDs (9001, 1001…) to portal user names.
- Comments pair with approvers by name, so with no names they show only IDs or nothing.

Step 1 confirms this against the live SAP replies before any change goes in.

## Fix
1. **Check first:** open Preview for 100225 and record what SAP's record read, report, approval-flow and comments replies actually return. Confirm the field names for initiator (`INIT_USERID`/`INIT_NAME`) and function (`EXTR_TXT`/`EXTRA_TXT`/`FUNCT`).
2. **Save the missing details when an NFA is created:** after SAP accepts the NFA, store the initiator's User ID and name plus the Function next to the subject and description already saved. Nothing changes in the SAP payload.
3. **Use the saved details in Preview / Print Form:** fill Initiator and Function from SAP first, then the saved copy, then the Report row (which also carries the function text).
4. **Approver names:** match each approver User ID (from the approval flow, or from APPROVERn in the comments reply) to a portal user and show that user's full name. If there's no match, show the SAP name, then the User ID.
5. **Comments:** pair each COMMENTn with its approver by User ID first, then by level, using those resolved names, so every remark appears as "Name — comment" in the correct version group.
6. For older NFAs created before this change, use the initiator from the Report row (`INIT_USERID`) so the "read as initiator" retry can still work.

## Not changing
SAP payloads, Create/Approve/Reject flows, emails, permissions, the Print Form layout, watermark, and the SAP-PDF-vs-X Preview rule.

## Technical details
- Migration: add nullable `initiator_id`, `initiator_name`, `function_name` to `sap_record_draft` (and a Quality migration file).
- `enfa-create.ts`: include those three values in the existing draft upsert after SAP succeeds.
- `print-initiator.functions.ts`: when there's no `nfa` row, build `savedDetail`/`initiatorName` from `sap_record_draft`. `getInitiatorRecordDetail` takes the initiator from the draft or the Report row.
- `prepare-web-print-form.ts`: pass `reportRow` values into the initiator/function resolution. Resolve approver names in one server lookup of User IDs to `profiles.full_name` (permission-checked through the Approvals/Report screen).
- `print-comment-history.ts`: keep matching by User ID, then level, with the resolved names.
- Tests: initiator/function fallback order, User ID-to-name resolution, and comment pairing for 100225-shaped data.
