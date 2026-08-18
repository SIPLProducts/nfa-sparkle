# Make Company F4 fully dynamic from SAP

## Confirmed cause

Your currently running `middleware/server.js` contains:

```text
if (method !== "GET" && method !== "HEAD" && p.body !== undefined ...) { body = ... }
```

So for the Company F4 call (`GET` + `{ "cc_code": "" }`) the middleware **removes the body** and SAP
receives an empty GET on `/e-nfa/enfa_report/create?sap-client=300`. SAP answers with the create-service
error **"Decoded attachment is empty"**, and the Create eNFA screen then falls back to the hardcoded
Ramky company list. Postman works because it sends the JSON body with GET.

## Changes

1. **Middleware: send the configured body on GET**
   - Replace the body-stripping condition so a `GET`/`HEAD` request carries the configured JSON body.
   - Because Node's `fetch` rejects GET bodies, use a native Node HTTP(S) request path for body-bearing
     GET/HEAD calls, with correct `Content-Type` and `Content-Length`.
   - Keep your added SAP request/response/status logging, auth, headers, query, timeout, multi-system
     routing, and all non-GET behavior unchanged.
   - Bump the middleware version so the installed copy can be identified after replacement.

2. **App: keep the endpoint exactly as configured in API Settings**
   - Resolve the active Company F4 row dynamically (path, method, query, headers, body, credentials).
   - Never convert the method or substitute a body; return a clear error if the saved body is not valid JSON.

3. **API Settings testing matches Create eNFA**
   - Test connection uses the same execution path as the Company lookup, so a green test proves the live call.

4. **Response mapping**
   - Accept SAP's direct array (and common wrappers), map `BUKRS` to the value and `BUTXT` to the label,
     trim, drop invalid rows, deduplicate by `BUKRS`, and keep the full list (no truncation for ~230 rows).

5. **Remove all hardcoded Company values from Create eNFA**
   - The dropdown starts empty and is populated only from the SAP response.
   - On failure it stays empty, shows SAP's own message plus a **Retry** action, and never shows the built-in list.
   - Sample data no longer injects a hardcoded company code.

6. **Verify**
   - Middleware log shows `GET .../create?sap-client=300` with the `{ "cc_code": "" }` payload and status 200.
   - Dropdown renders live values such as `1000 – Ramky Infrastructure Ltd`.
   - Regression-check Create ENFA, eNFA Report, detail and update endpoints.

## Deployment requirement

The updated `middleware/server.js` must replace the copy running on your network and that process must be
restarted. No application-side change can make the current middleware forward a GET body.

## Technical details

- `middleware/server.js`: GET/HEAD body forwarding via Node HTTP(S), preserved logging, version bump.
- `middleware/README.md`: update/restart instructions.
- `src/lib/sap-report.server.ts`: exact request preservation for the dynamically resolved endpoint.
- `src/lib/sap-call.server.ts`: full-size Company response handling.
- `src/lib/sap-api.functions.ts`: test parity with the live call.
- `src/lib/sap/master.ts`: `BUKRS`/`BUTXT` normalization and dedupe.
- `src/routes/_authed.nfa.new.tsx`: SAP-only company list, error/retry, no fallback.
