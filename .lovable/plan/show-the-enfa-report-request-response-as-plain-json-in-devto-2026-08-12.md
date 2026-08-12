# Show the eNFA report request/response as plain JSON in DevTools

Today the Reports screen calls the server through the framework's RPC layer, so the Network tab shows an encoded envelope (`{"t":10,"p":{"k":[...],"v":[...]}}`) instead of readable JSON. The fix is to make Execute a plain HTTP call whose request body and response body are exactly the SAP payload and the SAP response array.

## What changes

- Add a real HTTP endpoint for the report. The browser posts the 15-key filter object as-is and gets back the SAP response array as-is.
- The Reports screen calls that endpoint with `fetch` instead of the RPC server function.
- Result in Inspect → Network → the report request:
  - **Request payload** = exactly `{ "plant_from": "9000", "plant_to": "9010", ..., "r_reje": "" }` (all 15 keys, built dynamically from the filters).
  - **Response** = exactly the SAP array `[{ "REFFLD": "100068", ... }, ...]`.
- Keys and values stay fully dynamic — nothing hardcoded; the payload is whatever the filters hold and the response is SAP's untouched body.
- On failure, the endpoint returns SAP's status and error body so the failure is equally visible.
- The screen itself keeps the current clean look (no payload/response panels); the table, CSV export and toasts behave as they do now.

## Technical notes

- New server route `src/routes/api/enfa-report.ts` with a POST handler: verifies the caller's session (Authorization bearer token from the Supabase client), normalises the incoming body to the 15 report keys, resolves the registered `eNFA Report` endpoint plus SAP system/credentials, calls SAP through the existing `callSap` helper, and returns `new Response(sapBody, { status, headers: { 'content-type': 'application/json' } })` — SAP's raw body passed straight through, with `x-sap-status` / `x-sap-latency-ms` response headers for status and latency.
- The endpoint lookup, credential resolution and `callSap` code currently living inside `runSapEnfaReport` moves into a shared server-only helper (e.g. `src/lib/sap-report.server.ts`) so both the route and the existing server function use one implementation.
- `src/routes/_authed.report.tsx` replaces `useServerFn(runSapEnfaReport)` with a `fetch('/api/enfa-report', { method: 'POST', body: JSON.stringify(payload) })`, attaching the session token, then parses the array into the existing `SapReportRow[]` rendering path (tolerating both a bare array and a `{ body: [...] }` middleware wrapper).
- `runSapEnfaReport` stays available for any other caller; the Reports screen no longer uses it.
