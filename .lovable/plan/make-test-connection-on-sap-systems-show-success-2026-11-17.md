# Make "Test connection" on SAP Systems show success

## Problem
"Test connection" calls the SAP root path `/`, which SAP never serves, so it always shows 404 even when SAP is reachable.

## Change
In the SAP connection test only:
1. If a path is given, keep using it (unchanged).
2. Otherwise, test against an active configured endpoint for that SAP system (e.g. Plant F4) using its saved path, method and sample payload.
3. If no endpoint is configured, fall back to SAP's standard `/sap/public/ping`.
4. Treat any reply from SAP (including 401/403/404 from SAP itself) as "SAP reachable" and show the HTTP status plus which path was tested; only network/middleware failures show as failed.

## Unchanged
All other APIs, payloads, endpoint tests, SAP calls in Create NFA/Approvals/Reports, and settings.

## Technical details
- File: `src/lib/sap-api.functions.ts` (`testSapSystem`), small label tweak in `src/routes/_authed.admin.sap-api.index.tsx` to show the tested path.
- Logging via existing `logTest` stays.
