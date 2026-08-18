# ENFA Type F4 — dynamic NFA Type list from SAP

The "ENFA Type F4" endpoint already exists in API Settings (GET, `/e-nfa/enfa_report/create?sap-client=300`, body `{ "type": { "nfa_typ": "" } }`). Wire it up so the **NFA Type** dropdown on Create eNFA is filled from SAP instead of the built-in list.

## What changes

- **Create eNFA screen** — NFA Type dropdown loads on page open, shows "Loading NFA types from SAP...", then lists the exact `FUNCT` values SAP returns. On failure it shows the SAP error text with a Retry link; no hardcoded values remain in this field.
- **API Settings** — no new screen work; the existing ENFA Type F4 row (path, method, headers, body template, credentials) fully drives the call. Editing it there changes what the dropdown does.
- Submission keeps sending the selected value in the `FUNCT` field of the Create payload, exactly as SAP returned it.

## Technical notes

- `src/lib/sap/master.ts`: add `parseEnfaTypeF4` that unwraps the response (string/array/wrapped object), reads `FUNCT` case-insensitively, trims and de-duplicates, and returns `{ code, name }` with code = name = the SAP value. Keep `NFA_TYPES` exported for the other screens that still use it for labels.
- `src/lib/sap-report.server.ts`: add `callSapEnfaTypeF4()` — resolve the active endpoint named exactly "ENFA Type F4" first, then a narrow `%type%` fallback excluding create/company/plant/report names; load the SAP system + credentials the same way as Plant F4; start from the configured body template and validate it is JSON; honour the configured HTTP method.
- `src/routes/api/public/sap-enfa-type.ts`: authenticated proxy mirroring `sap-plant.ts`, including HTML 502/504 normalisation into clean JSON errors so the app error overlay never triggers.
- `src/routes/_authed.nfa.new.tsx`: replace the static `NFA_TYPES` options for this field with state fed by the new route (fetch on mount), with loading / empty / error + Retry states matching the Company and Plant fields.
