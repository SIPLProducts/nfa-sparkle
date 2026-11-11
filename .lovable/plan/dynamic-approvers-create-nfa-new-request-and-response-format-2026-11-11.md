# Dynamic Approvers (Create NFA) — new request and response format

## What changes for the user
In Create NFA with **Dynamic Approvers**, the approver list is loaded with SAP's new request, and each row SAP returns (Plant, Function, Approver User ID, Designation) appears in the Dynamic Approvers table. The initiator selects approvers as today, and the selected names/IDs/designations go into the Create NFA payload exactly as before. Predefined Approvers is not touched.

## Request
Dynamic mode will send:
```text
{ "approvers1": { "check": " ", "plant": [ { "plant": "9000" }, ... ] } }
```
- Wrapper key changes from `approvers` to `approvers1`; `check` changes from `""` to a single space `" "`.
- Plants remain every plant loaded for the chosen company (de-duplicated).
- The endpoint is found by its SAP API Settings name, now also matching **"Dynamic Approvals In Create"** (the entry in the screenshot), plus a fallback that finds any active entry whose request template contains `approvers1`.

## Response
SAP now returns a flat list, one approver per row:
```text
PSPNR -> Plant      FUNCT -> Function      APPROVER -> User ID      DESIGN -> Designation
```
- Rows are grouped by Plant + Function so the table keeps its current group headings; each row becomes one selectable approver.
- The current format (DESIG1/USERID1 … per row) is still understood, so nothing breaks if an older reply appears.
- Approver names and Department are filled from User Management by User ID, as today, and are sent in the name slots of the Create payload.

## Technical details
- `src/lib/sap-api-constants.ts`: `buildDynamicApproversPayload` returns `{ approvers1: { check: " ", plant: [...] } }`; add "Dynamic Approvals In Create" to `DYNAMIC_APPROVERS_ENDPOINT_NAMES`.
- `src/lib/sap-report.server.ts` `callDynamicApprovers`: body fallback also matches `%approvers1%`.
- `src/lib/sap/master.ts` `parseApprovalChains`: when rows have `APPROVER`/`DESIGN` (no DESIGn/USERIDn), group by PSPNR+FUNCT into chains with ordered levels. Predefined parsing path unchanged.
- Update `sap-approver-detail.test.ts` payload test; add a parser test using the two sample rows (22012284 SCM HEAD, 22007746 DIRE-PROJ).
- Verify: run tests, and call the Dynamic Approvers route for plant 9000 to confirm rows are returned and shown.
