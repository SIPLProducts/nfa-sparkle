# Create NFA "Request timed out" — why the screenshot still shows it

## What the screenshot tells us

The toast text "Saved locally, but SAP submission failed: Request timed out" is produced by the **old 20-second** timeout path, and the URL is `enfa.siplproducts.com` — the Quality server, which is still running the previously deployed build. The timeout fix made in the last step (Create ENFA now gets 120s, or 180s for large attachment batches, instead of 20s) exists in the code but has not been deployed to that server yet.

Verified server-side budgets that already allow the longer call:
- nginx (`deploy/nginx/enfa-qa.conf`, `nfa-quality.conf`): `proxy_read_timeout` 180-200s on the app and middleware locations.
- middleware `.env` (quality example): `TIMEOUT_MS=180000`.

So no further code change is required for the abort itself — only a redeploy.

## Plan

1. No new code change for the timeout: the Create ENFA call now sends `timeoutMs` 120s (180s when the payload exceeds ~1 MB) to the middleware, and the middleware/nginx budgets already exceed that.
2. Deploy the current build to the Quality server (`deploy/scripts/deploy-quality.sh`) and restart the app service so the new timeout takes effect.
3. Re-test Create NFA on `enfa.siplproducts.com`; if SAP still exceeds ~2 minutes, the next step is to raise the middleware `TIMEOUT_MS`/nginx window together rather than shortening it client-side.
4. Already applied in the same change set and included in the redeploy: no NFA data is written to `localStorage`/`sessionStorage` any more (screen state is memory-only, legacy `screen-state:*` keys are purged), and the timeout now returns the clearer message "SAP did not respond in time — the record was not created in SAP".

## Open question folded into the plan

The record is still written to the Cloud database before the SAP call, which is why the toast says "Saved locally". If you want SAP to be the only store (no local record when SAP fails), say so and that becomes a follow-up change.
