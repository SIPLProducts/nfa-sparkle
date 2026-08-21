# My NFAs list driven by the "Display Edit Data" API

## Current state (verified)

- The registered endpoint **Display Edit Data** already exists and is active: `PUT /e-nfa/enfa_approval/APPROVAL?sap-client=300` with body template `{ "report": "" }`.
- The **My NFAs** screen does not use it. It posts to `/api/public/enfa-approval`, which resolves the **Approval Get Data** endpoint — the same call the **Approvals** screen makes. So both screens currently show the same SAP worklist.

## What changes

**My NFAs** switches to the "Display Edit Data" endpoint:

- The list is fetched from that endpoint, with host, path, method, headers, query, credentials and the `{ "report": "" }` body all read from the saved endpoint record — nothing hardcoded.
- Rows render directly from SAP's response keys, as today: ENFA Number (`REFFLD`), Status (`STATUS_TXT`, colour derived from the text), Plant (`PSPNR` + `NAME1`), NFA Type (`FUNCT_TXT`), Subject (`SUBJECT`), Created (`BEGDA`) and level progress from `APPR1..APPR6` / `STAT1..STAT6`.
- Search, record count, radio selection, Refresh, and the Upload / Attached Docs / Preview / Edit toolbar keep working against the selected row's `REFFLD`, and the list refreshes after a successful upload or edit.
- Loading, empty ("SAP returned no records") and inline error states stay as they are; if the endpoint is missing or inactive the screen shows that message instead of crashing.
- **Approvals** keeps using "Approval Get Data" — unchanged.
- Visual design is unchanged.

## Technical notes

- `src/lib/sap-report.server.ts`: add `callEnfaDisplayEditData()` resolving the endpoint by name (`Display Edit Data`, fallback `%display%edit%`), reusing the existing system/credential/body-template resolution; default body `{ "report": "" }` only when the saved template is empty.
- New proxy route `src/routes/api/public/enfa-display-edit.ts`, bearer-verified, mirroring `enfa-approval.ts`: unwraps a middleware envelope and returns SAP's raw array with `x-sap-status` / `x-sap-latency-ms` headers, soft-failing with `ok:false` rather than a 502.
- `src/routes/_authed.nfa.my.tsx`: point the `load()` fetch at the new route. No other changes.
- No schema or database changes.
