# Function F4 — dynamic Function list from SAP

Make the **Function** dropdown on Create eNFA load live from SAP, driven entirely by the endpoint registered in Admin → SAP API Settings. No hardcoded values.

## SAP contract

- Endpoint: `/e-nfa/enfa_report/create?sap-client=300`, method GET with JSON body
- Request: `{ "FUNC": { "nfa_typ1": "<selected eNFA type>" } }`
- Response: `[ { "EXTR_TXT": "MARKETING" }, { "EXTR_TXT": "PROJECTS" }, ... ]`

## What changes

1. **API Settings** — register/ensure an active endpoint named `Function F4` (module Common, GET, Basic auth, path above, body template `{ "FUNC": { "nfa_typ1": "" } }`). Fully editable from the SAP API Settings screen like the other F4 endpoints.
2. **Parser** — add `parseFunctionF4` in `src/lib/sap/master.ts` reading `EXTR_TXT` (case-insensitive, deduped, tolerant of wrapped responses).
3. **Server call** — add `callSapFunctionF4(nfaType)` in `src/lib/sap-report.server.ts`: resolves the active `Function F4` endpoint (exact name first, narrow fallback that excludes create/company/plant/type/report), loads system + credentials, merges the selected eNFA type into the configured body template, honours the configured method/headers/query.
4. **Proxy route** — `src/routes/api/public/sap-function.ts`, same authenticated pattern and HTML→JSON 502/504 error normalisation as `sap-enfa-type.ts`.
5. **Create eNFA UI** — `src/routes/_authed.nfa.new.tsx`: drop the hardcoded `FUNCTIONS` import for this field; fetch the list when the eNFA Type changes; show "Loading functions from SAP…", "No functions returned by SAP", and an error message with a **Retry** link. Reset the selection when the type changes and send the selected value to SAP on submit.

## Notes

Existing Company / Plant / eNFA Type integrations are untouched; endpoint lookups stay mutually exclusive so the new row cannot collide with Create ENFA.
