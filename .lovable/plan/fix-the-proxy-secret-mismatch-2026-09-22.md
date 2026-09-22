# Fix the Proxy Secret mismatch

## Confirmed cause

- The portal’s saved Proxy Secret is exactly the value you entered, with no extra spaces.
- The middleware created a new `.env` during first startup and replaced the value from `.env.example` with a random secret.
- Therefore, the middleware and portal are using different values, and `/sap/call` correctly returns `401 Invalid proxy secret`.
- The portal’s current “Test middleware” action calls the public `/health` endpoint. Because `/health` does not require the secret, that test does not reliably detect a wrong Proxy Secret.

## Changes

1. Change first-start setup so an explicitly configured `PROXY_SECRET` in `.env.example` is preserved when `.env` is created; generate a random value only when the template is blank or still contains the documented placeholder.
2. Keep existing `.env` files untouched, preserving the current no-overwrite safety rule.
3. Change the portal’s middleware connection test to call the protected `/systems` endpoint, so it verifies the saved Proxy Secret rather than only checking whether the middleware is online.
4. Normalize newly entered Proxy Secrets at save time by removing accidental outer spaces, matching the middleware’s existing handling.
5. Improve the 401 message to state that the value in the portal must exactly match `PROXY_SECRET` in the middleware `.env`, without revealing either value.
6. Apply the same startup behavior to the packaged Quality middleware while keeping its existing internal port and deployment behavior unchanged.
7. Add Windows recovery guidance: update `middleware\.env`, stop the already-running process on port 3008, and restart it so the corrected value is loaded.

## Validation

- Verify an explicit template secret survives first-start `.env` creation.
- Verify placeholder and blank templates still receive a strong generated secret.
- Verify existing `.env` files are never overwritten.
- Verify the portal test succeeds only with a matching secret and reports a clear 401 for a mismatch.
- Confirm SAP request forwarding, API settings, existing ports, and all other middleware behavior remain unchanged.
