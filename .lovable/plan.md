# Fix Create NFA abort + stop storing NFA data locally

## What the log shows (verified)

- The payload SAP received is correct and dynamic: `user_name: "2026"` is genuinely the signed-in user's User ID — the `profiles` row for `sai@gmail.com` has `username = 2026`. So nothing is hardcoded and nothing is wrong with that value.
- The failure is a timeout, not a payload problem: `SAP REQUEST ERROR: This operation was aborted` comes from the middleware aborting its own upstream call.
- Root cause: `callEnfaCreate` (`src/lib/sap-report.server.ts`) calls `callSap` without a `timeoutMs`, so `src/lib/sap-call.server.ts` falls back to **20 s** for proxy calls (15 s direct) and sends `timeoutMs: 20000` to the middleware. The SAP create service takes longer than that — especially with attachments — so the middleware aborts mid-flight even though the on-prem `.env` allows 180 s.

## Fix

1. `src/lib/sap-report.server.ts` — `callEnfaCreate`
   - Pass an explicit generous timeout (180 s, matching the middleware/nginx budget) so SAP is given time to finish and the browser gets SAP's real reply instead of an abort.
   - Scale it with the payload size (bigger attachment batches get the full window) and keep the existing `maxBytes`.
2. `src/routes/api/public/enfa-create.ts`
   - When the call fails with an abort/timeout, return a clear message ("SAP did not respond in time — the record was not created in SAP") instead of a bare `SAP request failed`, keeping the existing `x-sap-url` / `x-sap-method` / `x-sap-request` / `x-sap-status` headers so Inspect → Network still shows the exact SAP call.
3. `src/routes/_authed.nfa.new.tsx`
   - Surface that message as-is in the toast. No payload changes — the create body stays exactly the SAP shape already sent.

## Stop persisting NFA data locally

- `src/lib/screen-state.ts` currently mirrors screen state into `sessionStorage` (`screen-state:*`). Remove the `sessionStorage` read/write entirely and make both `useScreenState` and `useScreenMemory` memory-only, plus a one-time cleanup that deletes any existing `screen-state:*` keys left in a user's browser.
- Result: no NFA rows, filters, or selections are written to `localStorage`/`sessionStorage`. Navigating screen-to-screen still keeps state in memory (existing behaviour), while a hard refresh, a new tab, or a fresh login always re-fetches from SAP/the API.
- `src/hooks/use-screen-entry-effect.ts` keeps its single timestamp key (a refresh de-dupe marker, no NFA data) — switching it to a module variable as well so nothing app-related remains in web storage.
- `InstallPrompt`'s dismiss flag stays (it is not NFA data).

## Note

Created NFAs are still written to the Cloud database `nfa` table before the SAP call — that is the app's server-side record, not browser storage. Say the word if you also want that row skipped so SAP is the only store.
