# Plant F4 — dynamic Plant list from SAP

Register the SAP Plant value-help service in API Settings and drive the Plant dropdown on Create eNFA entirely from SAP's response. No plant codes or names stay hardcoded.

## 1. API Settings — Plant F4 endpoint

Seed (or reuse the existing) endpoint row named **Plant F4**:

- Path `/e-nfa/enfa_report/create`, query `sap-client` from the selected SAP system
- Method `GET`, auth `Basic`, module `Common`, API type `fetch`, Active
- Request body template: `{ "plant": { "bukrs": "" } }`

Everything (host, path, method, headers, query, credentials) stays editable on the endpoint detail screen, and **Test connection** uses the same code path the app uses.

## 2. Plant field on Create eNFA

- When a Company is selected, the app calls the Plant service with `{ "plant": { "bukrs": "<selected company code>" } }`.
- The dropdown fills from the response rows, shown as `WERKS – NAME1`.
- States: "Loading plants…" while fetching, an inline error with a **Retry** link if SAP or the middleware is unreachable, and an empty (disabled) field until a company is chosen.
- Changing the company reloads the plant list and clears the current selection.
- The plant name sent to SAP on submit (`NAME1`) comes from the selected row, not from the built-in list.

## Technical notes

- `callSapPlantF4(bukrs)` in `src/lib/sap-report.server.ts`, mirroring `callSapCompanyF4`: resolves the endpoint by exact name "Plant F4" (narrow fallback on `%plant%`, excluding Create/Company rows), loads the SAP system + credentials, sends the configured method with the JSON body, `maxBytes` 200 KB.
- New public route `src/routes/api/public/sap-plant.ts` — same bearer-token check, HTML/502 normalisation and `{ body: … }` unwrapping as `sap-company.ts`; takes `{ bukrs }` in the POST body.
- `parsePlantF4(raw)` added to `src/lib/sap/master.ts`, reading `WERKS`/`NAME1` (case-insensitive, deduped) with the same wrapper-walking logic as `parseCompanyF4`.
- `src/routes/_authed.nfa.new.tsx`: replaces `PLANTS` / `plantsFor` usage with the fetched list keyed on the selected company; `PLANTS` mock data stays in master.ts only for other screens that still reference it.
- A migration inserts the Plant F4 endpoint row if it isn't already present.
