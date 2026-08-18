# Fix Company F4 GET integration and response mapping

## Confirmed cause

The saved **Company F4** endpoint is active and configured as `GET` with `{ "cc_code": "" }`. The current application changes that request to `POST`, while the local SAP middleware also removes bodies from `GET` requests. SAP therefore receives a different request from the working Postman call and returns the create-service error **“Decoded attachment is empty”**. The Company dropdown then falls back to the built-in Ramky list.

## Changes

1. **Preserve the configured GET request**
   - Stop converting Company F4 from `GET` to `POST`.
   - Pass the saved JSON request body unchanged with the configured method.

2. **Support SAP GET requests with JSON bodies in the local middleware**
   - Update the middleware transport so `GET` requests can carry the configured body, matching the working Postman request exactly.
   - Keep existing authentication, headers, query parameters, timeout handling, multi-system routing, and all non-GET endpoint behavior unchanged.

3. **Align API Settings testing with live behavior**
   - Make **Test connection** use the same configured method and body path as the Create eNFA Company lookup, so its result accurately represents the live integration.

4. **Harden Company response mapping**
   - Continue accepting the direct SAP array shown in the reference and common wrapper shapes.
   - Map `BUKRS` to the option value and `BUTXT` to the visible company name, trim values, ignore invalid rows, and avoid duplicate company codes.
   - Preserve the existing built-in fallback, SAP error detail, and Retry action.

5. **Verify end to end**
   - Confirm the middleware sends `GET /e-nfa/enfa_report/create?sap-client=300` with `{ "cc_code": "" }`.
   - Confirm a response such as `{ "BUKRS": "1000", "BUTXT": "Ramky Infrastructure Ltd" }` renders as `1000 – Ramky Infrastructure Ltd` in Create eNFA.
   - Regression-check Create ENFA and other SAP endpoints to ensure their configured methods and payloads are unchanged.

## Deployment note

Because the SAP call runs through the on-premise middleware, the updated middleware file must replace/restart the currently running local middleware before the application can send a GET body to SAP.

## Technical details

- `src/lib/sap-report.server.ts`: retain the endpoint’s configured method and body.
- `middleware/server.js`: use a Node HTTP(S) request path for body-bearing GET/HEAD calls, since standard `fetch` removes or rejects those bodies.
- `src/lib/sap-api.functions.ts`: make endpoint testing preserve configured bodies for Company F4.
- `src/lib/sap/master.ts`: normalize and deduplicate `BUKRS`/`BUTXT` response rows.
