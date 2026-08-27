# Reports → Edit: send `user_name` in the detail payload and show SAP's live response

## Current behaviour

Clicking **Edit** on E-NFA Report calls the registered "Get ENFA Number Deatils" endpoint
with `{"edit":{"reffld":"100030"}}`. SAP requires the requesting user too, so it answers
HTTP 200 with the plain text `"Note For Approval Can Only Be Edited By Initiator"`. The
dialog assumes JSON and crashes with `Unexpected token 'N' ... is not valid JSON`.

## What changes for the user

- The Edit request now sends the SAP user together with the record number:

```text
{ "edit": { "user_name": "SIPL_QM", "reffld": "100069" } }
```

- SAP's response is used as the live source for the form — Company (`CC_TEXT`), Plant
  (`PSPNR` / `NAME1`), Function (`FUNCT`), Subject, Scope Impact, Budget Impact,
  Timeline Impact and Detailed Description (`TEXT`) all come from the latest reply, so the
  dialog shows exactly what SAP holds right now.
- If SAP replies with a message instead of a record (for example the initiator-only
  notice), that exact sentence is shown in the dialog — never a JSON parse error — and the
  record opens read-only with Save hidden, since SAP would reject the update anyway.
- Everything else on the Reports screen (filters, table, Preview, Attached Docs, Upload)
  is untouched, and the My NFAs Edit flow keeps using its own endpoint.

## Nothing hardcoded

`user_name` is resolved at call time from the credentials of the registered endpoint /
active SAP system in Admin → SAP API Settings (the same user the call authenticates
with), and `reffld` comes from the selected row. The saved request-body template for
"Get ENFA Number Deatils" is updated to include `user_name` so the Settings screen and the
app show the same payload.

## Technical notes

- `src/lib/sap-report.server.ts` → `callEnfaDetail(reffld)`: build the body from the
  endpoint's stored template, setting `edit.reffld` and `edit.user_name` (uppercased
  resolved SAP username: endpoint username → system username), instead of a fixed
  `{edit:{reffld}}` literal.
- `src/routes/api/public/enfa-detail.ts`: when SAP's body is not valid JSON, return it as
  `{"message": "<raw SAP text>"}` so the response is always valid JSON with SAP's exact
  wording preserved; status/latency headers stay as they are.
- `src/components/report/RecordEditDialog.tsx`:
  - Parse responses defensively (string or `{message}` payload → treated as a SAP notice,
    object/array → record).
  - Map the response fields listed above into the form, including Company/Plant/Function
    display values from `CC_TEXT` / `PSPNR` / `NAME1` / `FUNCT` when SAP supplies them.
  - New notice state: show SAP's message and render the form read-only (Save hidden) when
    no record was returned.
- One database update: add `"user_name": ""` to the stored request body of the
  "Get ENFA Number Deatils" endpoint.
- No schema changes, no new endpoints.
