# Fetch ENFA record details from SAP when Edit is clicked

The "Get ENFA Number Deatils" endpoint is already registered in SAP API Settings. This plan wires it into the Reports screen so clicking **Edit** on a selected record calls SAP live and fills the form with SAP's response.

## What changes for the user

- Select a record in Reports and click **Edit**. The dialog opens and immediately calls the SAP detail API with the selected ENFA number.
- The form fills in from SAP's response: Company, Plant, NFA Type, Subject, Scope Impact, Budget Impact, Timeline Impact, and Detailed Description.
- While the call runs the dialog shows a loading state; if SAP fails or the endpoint isn't reachable, a clear message appears instead of empty fields.
- The request and response are a plain HTTP call visible in Inspect → Network (request body `{"edit":{"reffld":"<selected ENFA>"}}`, response the raw SAP JSON), the same way the report call already works.

## Nothing hardcoded

- The URL, method, auth, headers and SAP system all come from the registered endpoint row — matched by name/path containing `enfa` + detail, resolved at call time.
- `reffld` comes from the selected report row, never a fixed value.
- Form fields map from whatever keys SAP returns (`SUBJECT`, `SCOPE_IMPACT`, `BUDGET_IMPACT`, `TIMELINE_IMPACT`, `TEXT`, `CC_TEXT`, `PSPNR`, `NAME1`, `FUNCT`), with locally saved draft values taking over only after the user edits and saves.

## Technical notes

- `src/lib/sap-report.server.ts`: add `callEnfaDetail(reffld)` — looks up the detail endpoint dynamically (name ilike `%number%detail%` / `%enfa%detail%`, falling back to the registered detail row rather than the report row), then reuses the existing `callSap` path with body `{ edit: { reffld } }`.
- New route `src/routes/api/public/enfa-detail.ts`, mirroring `enfa-update.ts`: bearer-token check via Supabase claims, then the SAP call, returning SAP's raw body plus `x-sap-status` / `x-sap-latency-ms` headers so the exact payload/response are inspectable in Network.
- `src/components/report/RecordEditDialog.tsx`: on open, `fetch("/api/public/enfa-detail", …)` with the session token, parse the response (accepting a single object or a one-element array / middleware envelope), and seed the draft state from it; keep the existing `sap_record_draft` overlay for locally saved edits and the existing Save / Update in SAP buttons unchanged.
- Report screen layout, filters and table stay exactly as they are.
