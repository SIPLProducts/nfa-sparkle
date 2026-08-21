# Fix the "app encountered an error" popup

## What's actually happening

Reproduced in the live preview: the Dashboard itself renders fine. The error popup comes from the **Approvals worklist call failing**.

- The browser calls `/api/public/enfa-approval` and gets back **HTTP 502** (twice per load).
- Server log: `The SAP Approval Report endpoint is not registered or is inactive.`
- Confirmed against the database: there is **no endpoint named "Approval Report"** in SAP API Settings. The registered PUT endpoints on `/e-nfa/enfa_approval/APPROVAL?sap-client=300` are named `Display Edit Data`, `Edit IN My NFA`, and `MY NFA Select` — none of them match the lookup, and the fallback search excludes them too.

The failing request logs a browser console error, which is what triggers the generic "The app encountered an error" overlay.

## Fix

1. **Register the missing endpoint** (database seed, so it shows in Admin → SAP API Settings and can be edited there):
   - Name: `Approval Report`
   - Method: `PUT`
   - Path: `/e-nfa/enfa_approval/APPROVAL?sap-client=300`
   - Body template: `{ "report": "" }`
   - Active, module `Common`, same auth/system as the other eNFA endpoints.

2. **Fail softly instead of throwing a 502.** When the endpoint is missing or SAP is unreachable, the proxy returns a normal (non-error) response and the Approvals / My NFAs screens show a clean inline notice ("SAP worklist unavailable — check Admin → SAP API Settings") with a Retry button, instead of a red console error that pops the global error dialog.

3. **Stop the duplicate load** on the Approvals screen so the worklist is fetched once per mount.

## Technical notes

- Seed via migration into `sap_endpoint` (guarded so it is not duplicated if a row with that name already exists).
- `src/routes/api/public/enfa-approval.ts`: return `200` with `{ ok: false, message }` for configuration/upstream failures rather than a 5xx status; keep real auth failures as 401.
- `src/routes/_authed.approvals.tsx` and `src/routes/_authed.nfa.my.tsx`: handle the `ok:false` shape, render the inline notice + Retry, and guard the loader effect against double invocation.
- No change to SAP payload shapes or to any other screen.
