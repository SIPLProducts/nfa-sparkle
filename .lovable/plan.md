# Fix "Unauthorized" when executing the E-NFA Report

## What is happening

The red toast is not coming from SAP. It is our own `/api/enfa-report` route replying `401 {"error":"Unauthorized"}` before it ever calls SAP (the response carries no `x-sap-status`).

Confirmed by testing the live preview:

- You are signed in and a valid session token exists in the browser.
- Calling `/api/enfa-report` with that token still returns 401.
- The same route with no token returns the identical 401, so the token is being rejected (or not arriving) at the server.

Two candidate causes, both addressed below:

1. The endpoint sits at `/api/enfa-report`. Non-`/api/public/*` paths go through the platform's site-auth layer, which can consume/strip the `Authorization` header before our handler sees it.
2. The handler verifies the token with a hand-built Supabase client and `auth.getUser(token)`, which differs from the verification the rest of the app uses successfully (`getClaims`, via the standard auth middleware).

## Changes

1. **Move the endpoint to `src/routes/api/public/enfa-report.ts`** so the request reaches our handler untouched. Security is unchanged in substance: the handler still requires a valid bearer token and rejects anything else.
2. **Align token verification with the rest of the app** — same client construction and `getClaims(token)` check as `src/integrations/supabase/auth-middleware.ts`, including the apikey fetch wrapper.
3. **Make the 401 explain itself** — distinct messages for "no Authorization header" vs "token rejected", and a `console.error` on the server, so any remaining failure is diagnosable in one run instead of guesswork.
4. **Point the Report screen at the new path** in `src/routes/_authed.report.tsx` (only the URL changes; payload `{ report: { ... } }` and Network-tab visibility stay exactly as they are).

## Technical notes

- `src/lib/sap-report.server.ts`, `sap-call.server.ts` and the wire-key mapping are untouched.
- Verification after the change: call the endpoint from the preview with the live session and confirm a 200 plus `x-sap-status` set by SAP (a SAP-side error is then a genuinely different, visible failure).
