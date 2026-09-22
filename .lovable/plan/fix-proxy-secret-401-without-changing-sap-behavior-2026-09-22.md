# Fix Proxy Secret 401 without changing SAP behavior

## Confirmed cause

- The portal has a six-character Proxy Secret saved, with no leading or trailing spaces.
- The portal sends that saved value through the `x-proxy-secret` header.
- The configured middleware URL is online and reports middleware version 1.1.0 on port 3008.
- A protected `/systems` request using `123456` currently returns `401 Invalid proxy secret` from the live middleware. This confirms that the running Windows process loaded a different `PROXY_SECRET` from its local `.env`.
- The report request path currently converts this middleware authentication failure into the generic message “SAP responded with status 401,” making it look like an SAP login failure.

## Changes

1. Keep strict Proxy Secret authentication and all SAP forwarding behavior unchanged.
2. Correct the shared middleware response handling so a middleware-level `401 Invalid proxy secret` remains identifiable instead of being converted into an empty SAP response.
3. Show a precise portal message directing the administrator to match the saved Proxy Secret with `PROXY_SECRET` in `middleware\.env`; never display either secret in browser messages or logs.
4. Keep the Middleware test on the protected `/systems` endpoint so it verifies both connectivity and the secret before SAP calls are attempted.
5. Preserve the existing first-start behavior: an explicit value in `.env.example` is copied into a new `.env`; random generation occurs only for a blank or placeholder value; an existing `.env` is never overwritten.
6. Apply matching behavior to the downloadable and Quality middleware packages without changing their respective ports or deployment setup.
7. Add/update focused tests for successful proxy envelopes, middleware 401 responses, SAP-originated 401 responses, whitespace normalization, and first-start no-overwrite behavior.

## Required Windows restart

After the code update, the running middleware must load the same value already saved in the portal:

```powershell
# In D:\ENFA\nfa-sparkle\middleware\.env
PROXY_SECRET=123456

Get-NetTCPConnection -LocalPort 3008 | Select-Object OwningProcess
Stop-Process -Id <OwningProcess>
node server.js
```

Then use **Admin → SAP API Settings → Middleware Configuration → Test middleware**. A successful test confirms the portal and middleware agree before running the report.

## Verification

- Verify the live protected endpoint accepts the shared value after the Windows restart.
- Run focused automated tests and type checks.
- Confirm the report distinguishes a Proxy Secret mismatch from an SAP credential rejection.
- Confirm existing report payloads, SAP Basic authentication, approval flows, and other middleware routes remain unchanged.
