# Approval Chain driven by SAP

Make the Approval Chain tab read live chains from SAP instead of the local database, and register the endpoint in SAP API Settings.

## SAP contract

- Endpoint: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`, method GET with JSON body
- Request: `{ "approver": "" }`
- Response: array of rows with `PSPNR`, `FUNCT`, `EXTR_TXT`, `BEGDA`, `ENDDA`, and up to seven `DESIG1..7` / `USERID1..7` pairs

## API Settings

Ensure an active endpoint named **Approval Chain** (module Common, GET, Basic auth, SAP system "Use active system") with the path above and body template `{ "approver": "" }`. Fully editable from the SAP API Settings screen — nothing hardcoded; editing that row changes what the tab calls.

## User Management -> Approval Chain tab

- Remove the **New chain** button and the create/edit dialog; the tab becomes read-only, showing exactly what SAP returns.
- On opening the tab (and on every screen entry) call the endpoint and render one card/row per SAP record:
  - Header: Function (`FUNCT`) and Extra text (`EXTR_TXT`), with Project no. (`PSPNR`) and validity `BEGDA - ENDDA`.
  - Levels table: Level 1..n from the non-empty `DESIGn` / `USERIDn` pairs, showing designation and user id.
- States: loading skeletons, "No approval chains returned by SAP", and an error message with a **Retry** link. No static/demo rows and no local fallback.
- Optional approver filter box that sends its value as `approver` in the request; default empty string.

## Technical notes

- `src/lib/sap-report.server.ts`: add `callApprovalChain(approver)` — resolves the active `Approval Chain` endpoint by exact name first, with a narrow name-pattern fallback that excludes the existing approval action endpoints (Approval Get Data, Approved Button, Reject Button, Back To Intiator), loads system + credentials, merges `approver` into the saved body template, honours configured method/headers/query.
- New parser in `src/lib/sap/master.ts`: `parseApprovalChains` mapping each row to `{ pspnr, funct, extraTxt, begda, endda, levels: [{ level, designation, userId }] }`, skipping empty pairs and tolerating wrapped/enveloped responses and plain-text "no data" replies.
- New proxy route `src/routes/api/public/sap-approval-chain.ts` following the same bearer-auth + HTML->JSON error normalisation pattern as `sap-enfa-type.ts`.
- `src/components/admin/ApprovalChainTab.tsx`: replace the server-fn queries with a fetch to the new route; delete the dialog, draft state, save/delete mutations and the now-unused imports.
- The existing `approval_chain` tables and `approval-chain.functions.ts` stay in place (unused by the UI); no migration, and no changes to Approvals, Create NFA or any other screen.
