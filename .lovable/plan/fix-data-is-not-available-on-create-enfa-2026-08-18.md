# Fix "Data is not available" on Create eNFA

## Root cause (confirmed against the saved API Settings rows)

All eight registered SAP endpoints share the **same path** `/e-nfa/enfa_report/create?sap-client=300` — they differ only by name, HTTP method and body shape.

The Create ENFA lookup matches on `name ilike '%create%' OR path_or_url ilike '%create%'` and then takes the **oldest** row. Because every path contains "create", the oldest match is the **eNFA Report** endpoint (created 12 Aug, method **PUT**).

So the application sends the correct `{ "create": { ... } }` body, but with the **PUT** method and the report endpoint's configuration — SAP answers `Data is not available`. Postman works because it uses POST against the Create service.

## Fix

In `src/lib/sap-report.server.ts`, make `callEnfaCreate` resolve its endpoint the same disciplined way the F4 callers already do:

1. Exact match first: `name = 'Create ENFA'`, active.
2. Fallback: `name ilike '%create enfa%'` / `%create e-nfa%`, excluding rows whose name mentions report, company, plant, type, function, change or edit.
3. Never infer the endpoint from `path_or_url`, since every endpoint shares that path.
4. If nothing matches, keep the existing clear "register/activate the Create ENFA endpoint in Admin → SAP API Settings" error.

The method, host, headers, query and credentials continue to come from the matched row (POST for Create ENFA) — nothing hardcoded.

## Verification

Save a note on Create eNFA and confirm the toast shows SAP's `MESSAGE` and the returned `ENFA_NO`, and that the record's eNFA number is updated. No other screens or flows change.
