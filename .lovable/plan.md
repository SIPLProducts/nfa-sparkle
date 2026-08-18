# Company F4 — dynamic company list from SAP

Register the SAP Company value-help (F4) service in **Admin → SAP API Settings** and use it to fill the **Company** dropdown on the Create eNFA screen, so the list comes from SAP instead of the hardcoded Ramky list.

## 1. API Settings — "Company F4" endpoint

Seed a ready-to-edit endpoint row (left untouched if one already exists):

- Name: `Company F4`, module `Common`, auth `Basic`, API type `fetch`
- Path: `/e-nfa/enfa_report/create`, query `sap-client` inherited from the selected SAP system
- Method: `POST` with request body template `{ "cc_code": "" }`
- Active, routed through the local middleware when proxy mode is on, like every other endpoint

Everything on the endpoint detail screen (path, method, headers, query, body template, credentials, Test connection, Active toggle) continues to control this call. If the service really needs GET, changing the method on that screen is enough — nothing else has to change.

## 2. Create eNFA — Company dropdown fed by SAP

- On screen load the Company select fetches the list from the registered endpoint and shows `BUKRS – BUTXT` (e.g. `1000 – Ramky Infrastructure Ltd`), with a short "Loading companies…" state.
- The selected `BUKRS` is what gets submitted as `CC_code` to the Create service.
- If the endpoint is missing, inactive, or SAP fails, the field falls back to the current built-in list and a small note explains the SAP list could not be loaded — the screen stays usable.
- Plant, project and all other fields keep their current behaviour. Since SAP company codes differ from the built-in codes, the Plant dropdown will list all plants when the chosen company has no local match, so it stays selectable until a Plant F4 service is added.

## Technical notes

- New helper `callSapCompanyF4()` in `src/lib/sap-report.server.ts`: looks the endpoint up dynamically (name `%company%` / body containing `cc_code`), resolves system + credentials exactly like the existing helpers, and calls the shared `callSap` with the configured method and body template.
- New route `src/routes/api/public/sap-company.ts`, mirroring `enfa-create.ts`: verifies the caller's session bearer token and returns SAP's raw JSON, so the request/response are visible in the browser Network tab.
- Response parsing is tolerant: accepts a bare array, `{ company: [...] }`, or any single array property, and maps `BUKRS`/`BUTXT` (case-insensitive) to `{ code, name }`.
- One migration inserts the `Company F4` endpoint row only if no matching row exists.
- Existing screens, report, update and create flows are untouched.
