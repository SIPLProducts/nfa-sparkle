# Fix the Edit button error on E-NFA Report

## What is actually happening

Clicking **Edit** calls the registered "Get ENFA Number Deatils" endpoint correctly
(`PUT /e-nfa/enfa_report/create?sap-client=300`, body `{"edit":{"reffld":"100030"}}`).
SAP answers HTTP 200 with a plain text message instead of a record:

```text
"Note For Approval Can Only Be Edited By Initiator"
```

Two separate problems follow from that:

1. **The red error is a crash, not a SAP message.** The dialog assumes the 200 body is
   JSON and calls `JSON.parse` on it, so the user sees
   `Unexpected token 'N', "Note For A"... is not valid JSON` instead of SAP's sentence.
2. **SAP legitimately refuses the edit.** Record 100030 was initiated by
   "ABAPER Narender", while the app calls SAP with the shared technical user, so SAP
   returns its authorization notice rather than the record. Nothing in the app can
   change that verdict — it must be shown clearly instead of swallowed.

## What changes for the user

- Any plain-text reply from SAP (quoted string, bare text, or `{message: ...}`) is shown
  as SAP wrote it, e.g. "Note For Approval Can Only Be Edited By Initiator" — no JSON
  parse errors ever surface again.
- When SAP declines the edit, the dialog opens in **view-only** mode: the record's known
  values from the report row are displayed, all fields are disabled, and the **Save**
  button is hidden so no update can be attempted that SAP will reject.
- When SAP returns a real record, the dialog behaves exactly as today (fields editable,
  Save posts to the Change Report endpoint).
- The Preview, Attached Docs, Upload and Report flows are untouched.

## Technical notes

- `src/components/report/RecordEditDialog.tsx`
  - Add a shared `readSapPayload(text)` helper: trim, attempt `JSON.parse`, and if the
    result is a string (or parsing fails) treat the content as a SAP message rather than
    a record. Object/array results keep flowing through the existing `pickDetail`.
  - New `readOnlyNotice` state: set when SAP returns a message instead of a record.
    Rendered as a neutral notice banner (not the destructive style), fields rendered
    disabled, Save button hidden.
  - Reuse the same helper in `sendToSap` so update replies are parsed the same way.
- `src/routes/api/public/enfa-detail.ts` (and the `select` twin used by My NFAs): when
  SAP's body is not valid JSON, wrap it as `{"message": "<raw text>"}` so the response is
  always valid JSON while preserving SAP's exact wording.
- No endpoint, schema, or SAP-credential changes; the endpoint continues to be resolved
  dynamically from Admin -> SAP API Settings.

## Follow-up (not part of this fix)

If users should be able to edit their own SAP-initiated records, SAP needs to see each
user's own SAP user ID instead of the shared technical account. That requires per-user
SAP credentials and can be planned separately.
