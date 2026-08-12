# SAP eNFA Report API integration

Wire the SAP `enfa_report` service into API Settings and make the Reports screen run entirely off SAP, sending the exact request payload and rendering every response field.

## 1. API Settings — register the endpoint

Seed a ready-to-use endpoint so it appears in the APIs list:

- Name: `eNFA Report`, module `Common`, auth `basic`, API type `fetch`
- Path: `/e-nfa/enfa_report//create`, method `PUT`
- Query: `sap-client` inherited from the selected SAP system (300)
- Request body template pre-filled with the full payload (all 15 keys, blank values)
- Pinned to the active SAP system (base `http://10.200.1.2:8000`), routed through the local middleware when proxy mode is on

The endpoint detail screen already lets you edit the path, headers, query, body template, credentials and run "Test connection", so the payload/response can be verified there.

## 2. Reports screen — SAP as the data source

Replace the current database query with a call to the SAP endpoint.

Filters map 1:1 to the request payload:

| Filter | Payload keys |
|---|---|
| Plant (from / to) | `plant_from`, `plant_to` |
| ENFA Type (from / to) | `funct_from`, `funct_to` |
| ENFA No (from / to) | `nfano_from`, `nfano_to` |
| Function (from / to) | `extra_from`, `extra_to` |
| Date range | `dat_from`, `dat_to` |
| Approver IDs (from / to) | `usrid_from`, `usrid_to` |
| In Process / Completed / Rejected checkboxes | `r_proc`, `r_comp`, `r_reje` ("X" when ticked) |

Each range filter renders as a compact "from → to" pair using the existing plant / type / function dropdowns where a code list exists, and plain inputs for ENFA No and approver IDs.

Execute sends the payload; a JSON "Request payload" preview panel shows exactly what is being sent, and a "Response" panel shows status, latency and raw JSON, so the payload is inspectable both in the panel and in the browser Network tab (the Execute call is a real browser request carrying the payload).

## 3. Results table — all response fields

Columns, in SAP order:

ENFA Number (`REFFLD`), Plant (`PSPNR`), Plant Name (`NAME1`), NFA Type (`FUNCT_TXT`), Function (`EXTR_TXT`), Subject (`SUBJECT`), Initiator (`INIT_NAME`), Creation Date (`BEGDA`), then Designation/Approver/Status for levels 1-6 (`ROLE1..6`, `APPR1..6`, `STAT1..6`), and ENFA Status (`STATUS_TXT`).

- Desktop: horizontally scrollable table with sticky first column; level blocks grouped under L1-L6 headers.
- Mobile: card per record with the header fields plus an expandable approver chain.
- CSV export includes every column with the business labels above.
- Empty / loading / error states, including a clear message when SAP or the middleware is unreachable.

## Technical notes

- New server function `runSapEnfaReport` in `src/lib/sap-api.functions.ts`: authenticated (not admin-only, so any signed-in user can run the report), looks up the endpoint by a fixed key, builds the payload from validated filter input, calls it through the existing `callSap` helper (middleware or direct), and returns `{ status, latencyMs, rows, raw, error }`.
- The endpoint row is inserted by a migration; response parsing tolerates both a bare array and `{ body: [...] }` from the middleware wrapper.
- The Reports route calls the function from the component (not the loader) so the request appears in the Network tab; payload echoed back in the response for the preview panel.
- Credentials stay server-side; only the payload and parsed rows cross the wire.
