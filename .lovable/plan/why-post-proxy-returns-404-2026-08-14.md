# Why `POST /proxy` returns 404

## What the log shows

Your middleware only exposes three routes: `GET /health`, `GET /systems`, `POST /sap/call`. Anything else falls through to the catch-all `404 {"error":"Not found"}` at the end of `middleware/server.js`.

There is no `/proxy` path anywhere in the app: every SAP call is built as `<middleware URL>/sap/call`, and the saved middleware URL in settings is exactly `https://curfew-thinning-shadow.ngrok-free.dev` with no extra path. That matches the log — the two `POST /proxy` hits at 17:30 and 17:40 got 404, and every call the app actually makes (`POST /sap/call`, from 17:43 onward) returned 200.

So `/proxy` came from outside the app: a manual Postman/curl test, a browser tab left open from an earlier middleware version, or an old ngrok inspector replay. Nothing in the portal is broken because of it.

## One real, related issue worth fixing

The **Test middleware** button does a `GET` on the bare middleware URL (`/`), not on `/health`. The middleware has no `/` route, so that button also lands on the same 404 catch-all and reports a failure even when the middleware is perfectly healthy.

Fix: point the test at `GET <middleware URL>/health` and treat the returned `{ ok: true, service, version, systems }` payload as the success signal, showing the version and configured systems in the result panel.

## Technical detail

- File: `src/lib/sap-api.functions.ts`, `testMiddleware` server function — append `/health` to the configured URL (trimming trailing slashes) before calling `fetchWithTimeout`.
- No change to `/sap/call` routing, no middleware change, no database change.
