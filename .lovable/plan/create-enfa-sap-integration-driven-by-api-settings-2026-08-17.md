# Create eNFA -> SAP integration (driven by API Settings)

Wire the SAP `create` service into the portal the same dynamic way the report, detail and update services already work: the endpoint is registered in **Admin -> SAP API Settings** and the Create eNFA screen simply uses whatever is saved there. Nothing about the SAP host, path or payload is hardcoded in the screen.

## 1. API Settings — register the Create ENFA endpoint

Seed a ready-to-edit endpoint row so it shows in the APIs list:

- Name: `Create ENFA`, module `Common`, auth `Basic`, API type `push`
- Path: `/e-nfa/enfa_report/create`, method `POST`, query `sap-client` inherited from the selected SAP system
- Request body template pre-filled with the full `{ "create": { ... } }` payload (all keys blank, including the `file` array)
- Routed through the local middleware when proxy mode is on, exactly like the other endpoints

Everything on the endpoint detail screen (path, method, headers, query, body template, credentials, Test connection, Active toggle) keeps working and continues to control this call.

## 2. Create eNFA screen — submit to SAP

On **Submit** (not on Save draft), after the local record is saved the screen posts the record to SAP through the registered endpoint and shows the SAP outcome:

- Success (`STATUS: "S"`): toast `Submitted successfully with ENFA No 100087`, and the returned `ENFA_NO` is stored on the record and shown as the eNFA number.
- Failure or endpoint not registered / inactive: a clear error message naming the reason; the local record is still saved so no work is lost.

Field mapping (screen -> SAP key):

| Screen field | SAP key |
|---|---|
| Company | `CC_code` |
| Plant | `PSPNR` |
| Plant name | `NAME1` |
| NFA type | `FUNCT` |
| Function | `EXTR_TXT` |
| Subject | `SUBJECT` |
| Scope impact | `SCOPE_IMPACT` |
| Budget impact (Lakhs) | `BUDGET_IMPACT` |
| Timeline (days) | `TIMELINE_IMPACT` |
| Detailed description (plain text) | `TEXT` |
| Attachments | `file: [{ file_name, file }]` (base64 content) |

Values are sent as strings in SAP's format (budget with two decimals, timeline as a whole number).

## Technical notes

- New helper `callEnfaCreate(payload)` in `src/lib/sap-report.server.ts`: looks the endpoint up dynamically by name/path (`%enfa%create%`), resolves the SAP system and credentials the same way as the existing helpers, and calls the shared `callSap`.
- New route `src/routes/api/public/enfa-create.ts`, mirroring `enfa-report.ts`: verifies the caller's session bearer token, builds the `{ create: { ... } }` payload from validated input, and returns SAP's raw JSON — so the request and response are visible in the browser Network tab.
- Payload builder + key map added to `src/lib/sap-api-constants.ts` (like `wrapReportPayload`), so the exact wire keys live in one place.
- Attachments are read as base64 in the browser and sent in the `file` array; the existing upload-to-storage behaviour is unchanged.
- One migration inserts the `Create ENFA` endpoint row; if a matching row already exists it is left untouched.
- Existing screens, filters, approvals and report behaviour are untouched.
