# Use the "MY NFA Select" SAP API for Edit on the My NFAs screen

The endpoint is already registered in Admin → SAP API Settings as **MY NFA Select**
(PUT `/e-nfa/enfa_approval/APPROVAL?sap-client=300`, body `{ "edit": { "reffld": "..." } }`).
Today the Edit dialog on both Reports and My NFAs calls the older
"Get ENFA Number Deatils" endpoint on the report URL, so My NFAs is not using this API.

## What changes for the user

- On **My NFAs**, selecting a record and clicking **Edit** loads the form from the
  MY NFA Select response: Company (CC_TEXT), Plant (PSPNR + NAME1), NFA Type (FUNCT),
  Subject, Scope Impact, Budget Impact, Timeline Impact and Detailed Description (TEXT) —
  all straight from SAP, nothing hardcoded, refetched on every open.
- The **eNFA Report** screen keeps using its existing detail endpoint, unchanged.
- If SAP returns an error or no record, the dialog shows SAP's own message.

## Technical notes

- `src/lib/sap-report.server.ts`: add `callEnfaSelect(reffld)`, resolving the endpoint by
  exact name `MY NFA Select` (fallback: name containing "nfa select"), and sending the
  endpoint's saved body template with `reffld` substituted. Method/path/query/headers/
  credentials all come from the saved endpoint + SAP system.
- New proxy route `src/routes/api/public/enfa-select.ts`, bearer-verified, mirroring
  `enfa-detail.ts`: validates `reffld`, unwraps a middleware envelope, returns SAP's object.
- `src/components/report/RecordEditDialog.tsx`: accept an optional `endpoint` prop
  (`"detail" | "select"`, default `"detail"`) that picks which proxy URL to call; the
  field mapping (CC_TEXT, PSPNR, NAME1, FUNCT, SUBJECT, SCOPE_IMPACT, BUDGET_IMPACT,
  TIMELINE_IMPACT, TEXT) and the save/update path stay as they are.
- `src/routes/_authed.nfa.my.tsx`: pass `endpoint="select"` to `RecordEditDialog`.
- No schema change; the endpoint row already exists.
