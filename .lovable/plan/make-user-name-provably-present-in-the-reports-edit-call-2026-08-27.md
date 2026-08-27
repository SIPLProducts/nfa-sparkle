# Make `user_name` provably present in the Reports Edit call

## What the screenshots actually show

The DevTools "Request Payload" for `enfa-detail` is the browser → app request, not the app → SAP request. The browser has never sent `user_name`; the server adds it just before calling SAP, so `{"edit":{"reffld":"100069"}}` in DevTools is expected and is not proof that SAP received it without the user.

Verified in the code and settings:

- `callEnfaDetail` builds `{ edit: { ...template, user_name: <resolved user, uppercased>, reffld } }`.
- The resolution chain is endpoint username → active SAP system username.
- The "Get ENFA Number Deatils" endpoint has no username and no system assigned, so it relies on the active system fallback — the active system (SAP DEV, 10.200.1.2:8000, client 300) has username `sipl_qm`, which uppercases to `SIPL_QM`.

So on a build that contains this change, SAP receives `SIPL_QM`. The likely cause of what you are seeing is either the deployed server still running the pre-fix build, or the resolution silently returning empty in that environment.

## Changes

1. **Make the payload visible from the browser.** `enfa-detail` returns the exact JSON body sent to SAP in a response header (`x-sap-request-preview`) alongside the existing status/latency headers, so you can confirm `user_name` from DevTools without reading middleware logs. Same for `enfa-report`.

2. **Never send an empty user.** In `callEnfaDetail` (and `callEnfaReport`), if the resolved SAP username is empty, fall back to the username stored on the endpoint's template body, and if still empty return a clear configuration error instead of calling SAP with `user_name: ""`. Also attach the endpoint to the active SAP system so the username resolution is not dependent on the "first active system" fallback.

3. **Echo it in the app.** The Edit dialog's existing error/notice banner shows the resolved SAP user when SAP replies with a text notice, so it is obvious which SAP user the call was made as.

4. **Redeploy note.** The quality server must be rebuilt for these server-side changes to take effect; the browser payload will still read `{"edit":{"reffld":"…"}}` by design.

## Technical notes

- `src/lib/sap-report.server.ts` — extract a small `resolveSapUser(ep, sys)` helper used by `callEnfaDetail` and `callEnfaReport`; return a configuration error when it resolves to empty; keep the existing settings-driven template merge and everything else unchanged.
- `src/routes/api/public/enfa-detail.ts` and `src/routes/api/public/enfa-report.ts` — add the `x-sap-request-preview` header (request body only, no credentials).
- `src/components/report/RecordEditDialog.tsx` — display-only addition of the SAP user in the existing notice banner.
- One settings update: assign the SAP DEV system to the "Get ENFA Number Deatils" endpoint.
- No change to Report filters, Preview, Attachments, Upload, My NFAs, or refresh behaviour.
