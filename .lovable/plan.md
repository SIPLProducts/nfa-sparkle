# Fix: report shows 0 results even though SAP returns records

## What's actually happening

SAP and the middleware are fine. The records are lost inside our own server helper.

The shared SAP call helper cuts every response down to the **first 4000 characters** before returning it. Your report response is much larger than that, so what comes back to the Report screen is a JSON document that stops mid-record. The browser can't parse a half-finished JSON document, so it treats the result as "nothing came back" and shows *"SAP returned no records for these filters"*.

This is confirmed by the actual response captured from the app: it starts with valid records and simply stops mid-row.

That 4000-char cap is right for the "Test connection" preview in API Settings (where we only want a short sample), but wrong for the report, which needs the whole payload.

## The fix

1. In the shared SAP helper (`src/lib/sap-call.server.ts`):
   - Make the response size limit a parameter instead of a hardcoded 4000, defaulting to 4000 so the API Settings test preview is unchanged.
   - Apply the caller's limit in both the direct path and the middleware/proxy path (today the proxy path also re-truncates to 4000 when re-serialising).
2. In `src/lib/sap-report.server.ts`: the report call already asks for a 2 MB limit — that limit will now actually be honoured.
3. In the report API route (`src/routes/api/public/enfa-report.ts`): keep returning SAP's raw body; unwrap the middleware's `{ ok, status, body }` envelope so the screen always receives a plain array.
4. In `src/routes/_authed.report.tsx`: if the response body ever fails to parse, show a clear error ("Could not read the SAP response") instead of the misleading "no records" message.

## Verification

Run the report with Plant 9000 → 9000 and confirm the rows render, and that the Network tab shows the full array. Also re-run a Test connection in SAP API Settings to confirm the short preview still behaves as before.
