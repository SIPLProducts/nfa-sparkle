# Make Company F4 fully dynamic from SAP

## Confirmed current state

- **Company F4** is saved as an active `GET` endpoint with the SAP path and `{ "cc_code": "" }` body.
- The current repository passes the saved method and body to the middleware, and its middleware source supports a body-bearing `GET` through Node HTTP(S).
- The live Create eNFA request still receives **“Decoded attachment is empty”**, indicating the active on-premise middleware is not yet forwarding the request in the same shape as the current source/Postman request.
- Create eNFA currently initializes and falls back to the hardcoded `COMPANIES` list whenever SAP fails, which is why those values appear instead of the SAP response.

## Changes

1. **Use API Settings as the single Company API source**
   - Resolve the active Company F4 endpoint dynamically from SAP API Settings.
   - Preserve its configured `GET` method, exact path/query, headers, credentials, and saved `{ "cc_code": "" }` body without method conversion or hardcoded endpoint details.
   - Validate the saved body as JSON and return a clear configuration error when invalid.

2. **Guarantee GET-with-body transport through the local middleware**
   - Keep the Node HTTP(S) transport for body-bearing `GET` requests and ensure `Content-Type` and `Content-Length` are sent correctly.
   - Add safe middleware diagnostics showing method, path, body byte count, and upstream status without logging credentials or body content.
   - Update the middleware version/readme so the installed instance can be identified and replaced before restart.

3. **Make API Settings testing match Create eNFA**
   - Use the same shared Company F4 execution path for **Test connection** and the Create eNFA lookup.
   - Display SAP’s raw response/status in the Response tab so a successful test confirms the exact integration used by the form.

4. **Map the SAP response reliably**
   - Accept the direct array returned by SAP and supported wrapper forms.
   - Map `BUKRS` to the Company value and `BUTXT` to its label, trim fields, discard invalid rows, and deduplicate by `BUKRS`.
   - Preserve the complete response for lists larger than the current response-size limits.

5. **Remove all hardcoded Company values from Create eNFA**
   - Start the Company dropdown empty and populate it only with the live SAP response.
   - Do not show the built-in Ramky list when loading fails or SAP returns no valid rows.
   - Keep the Company field disabled/empty with the SAP error and **Retry** action until dynamic values load.
   - Prevent sample-data loading from injecting a hardcoded Company code; it will use an available SAP option only after the list loads.

6. **Verify end to end**
   - Confirm the middleware forwards `GET /e-nfa/enfa_report/create?sap-client=300` with the JSON body `{ "cc_code": "" }`.
   - Confirm API Settings Test connection and Create eNFA receive the same SAP response.
   - Confirm the dropdown renders values such as `1000 – Ramky Infrastructure Ltd`, with no built-in Company entries.
   - Regression-check existing SAP report, detail, update, and Create ENFA calls.

## Deployment requirement

The updated `middleware/server.js` must replace the currently running on-premise copy and that service must be restarted. Application deployment alone cannot change how the local SAP middleware forwards the non-standard GET body.

## Technical details

- `src/lib/sap-report.server.ts`: dynamic endpoint resolution and exact request preservation.
- `src/lib/sap-call.server.ts`: full Company response transport and shared call behavior.
- `src/lib/sap-api.functions.ts`: API Settings test parity.
- `src/lib/sap/master.ts`: `BUKRS`/`BUTXT` normalization only; no Company fallback for Create eNFA.
- `src/routes/_authed.nfa.new.tsx`: SAP-only Company state, retry/error handling, and sample behavior.
- `middleware/server.js` and `middleware/README.md`: GET-body forwarding, diagnostics, versioning, and restart instructions.
