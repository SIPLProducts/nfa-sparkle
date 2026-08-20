# Fix: upload to SAP fails with an app error

## What is actually happening (confirmed from the dev-server log)

```text
[enfa-upload] SAP call failed: null This operation was aborted
```

The upload never reached a SAP answer — our own request to the middleware was
aborted by a timeout. Every SAP call in `src/lib/sap-call.server.ts` is hard-coded
to a 20 second (proxy) / 15 second (direct) limit, with no way to raise it per call.
A document upload sends the whole file as base64 and SAP takes longer than that,
so the call is cut off, the route returns a 502, and the screen shows a generic error.

The middleware itself allows 30s by default and accepts a `timeoutMs` field we
currently never send, so the app always gives up first.

## The fix

1. Make the timeout a per-call option
   - Add an optional `timeoutMs` to the `callSap` options in `src/lib/sap-call.server.ts`.
   - Pass it to `fetchWithTimeout` for direct calls, and include it in the JSON payload
     sent to the middleware so the middleware waits the same amount of time.
   - Keep today's 15s/20s as the default so nothing else changes.

2. Give the heavy calls a realistic window
   - Upload (`callEnfaUpload`), attachments download and preview/print get a much
     longer budget (about 3 minutes), since they move large base64 payloads.

3. Replace the confusing message
   - When a call is aborted, return "SAP did not respond within N seconds — the file may
     be too large or the SAP service is slow" instead of "This operation was aborted",
     so the toast tells the user what to do.

4. Guard oversized uploads earlier
   - Keep the existing 40 MB client-side check, and report the total size in the message
     so a genuinely too-large file is rejected instantly instead of after a long wait.

## Technical notes

- Files touched: `src/lib/sap-call.server.ts` (timeout plumbing + abort message),
  `src/lib/sap-report.server.ts` (per-endpoint timeout values),
  `src/routes/api/public/enfa-upload.ts` (pass the message through unchanged).
- No endpoint configuration, payload shape or SAP API Settings data changes.
- `middleware/server.js` already honours `timeoutMs`; no middleware redeploy is needed,
  though raising `TIMEOUT_MS` in its `.env` is optional if SAP is very slow.
