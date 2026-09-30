# Fix SAP middleware 404 without changing API behavior

## Confirmed finding

- The app correctly sends `POST <saved middleware URL>/sap/call` with JSON and `x-proxy-secret`.
- Both current middleware copies expose `POST /sap/call`, validate the secret, preserve GET request bodies, add Basic authentication, and forward the configured SAP URL, query, headers, and body.
- The response `No route for POST /sap/call` is not produced by the current middleware. SAP was therefore not reached; the request is landing on another service, an incorrect port/path, or an older middleware process.
- In the Quality deployment, the intended route is public port `3004` → nginx → middleware port `3005`. Port `8081` is the portal and must not be saved as the Middleware URL.

## Plan

1. **Identify the actual destination on the Quality server**
   - Read the saved Middleware URL from `sap_middleware_config` without exposing the Proxy Secret.
   - Compare requests in the middleware nginx access log, middleware PM2 log, and portal PM2 log.
   - Test `/health`, authenticated `/systems`, and `POST /sap/call` directly on ports 3005 and 3004 to identify the first failing hop.

2. **Correct only the broken middleware hop**
   - If the saved URL targets `8081`, another port, or includes an API path, change only the Middleware URL to `http://10.200.1.7:3004`.
   - If port 3004 is misrouted, restore its existing nginx proxy to `127.0.0.1:3005` and reload nginx.
   - If an old process owns port 3005, restart only `enfa-quality-middleware` from the packaged Quality middleware; do not restart unrelated apps or recreate database volumes.

3. **Verify request integrity end to end**
   - Confirm the middleware receives `POST /sap/call`, accepts `x-proxy-secret`, and logs the resolved SAP method, URL, payload size, status, and response without exposing credentials.
   - Verify the saved endpoint method, path, `sap-client`, JSON payload, Content-Type/Accept headers, and Basic-auth source remain settings-driven.
   - Re-test Display Edit Data, Company F4, and NFA Type F4; confirm browser requests no longer return 404/424 and SAP returns its actual response.

4. **Prevent recurrence without changing SAP functionality**
   - Make the middleware connection check require the expected service identity/version from `/health` before API calls are considered healthy.
   - Improve this specific 404 message to report that the Middleware URL reached the wrong service, while preserving all existing endpoint payloads, methods, authentication, and response handling.

## Validation

- `/health` on public port 3004 identifies `enfa-sap-middleware` version 1.1.0.
- Authenticated `/systems` succeeds with the existing Proxy Secret.
- A protected `/sap/call` test reaches SAP and returns the middleware response envelope rather than a route 404.
- My NFAs loads without the red 404 banner; Company and NFA Type requests no longer return 424 caused by the same middleware routing issue.
- No SAP endpoint definitions, payload templates, credentials, users, application data, ports, or unrelated APIs are changed.
