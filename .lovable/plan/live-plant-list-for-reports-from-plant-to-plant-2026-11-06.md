# Live Plant list for Reports (From Plant / To Plant)

## What changes
- On the E-NFA Report screen, the From Plant and To Plant dropdowns will list plants returned by SAP ("F4 In Reports Plant Field" in SAP API Settings) instead of the built-in fixed list.
- Each option shows "code – name" (e.g. "1000 – RIL - Head Office"); the selected plant code is what goes into the report filter, exactly as today.
- If SAP can't be reached, a short message shows and the fields stay usable (empty list); the report itself is unaffected.

## What stays the same
- Report request, filters, columns, export, validations, and every other SAP call (including the Create NFA Plant list) are untouched.

## Technical details
- `src/lib/sap/report-plants.ts`: `buildReportPlantPayload()` → `{ "plant": "" }` and `parseReportPlants(json)` mapping `WERKS`/`NAME1` to `{ code, name }` (dedup, sorted by code); unit tests with the sample response.
- `src/lib/sap-report.server.ts`: `callReportPlantF4()` — finds the active endpoint named "F4 In Reports Plant Field" in SAP API Settings, uses its saved method (GET), URL and auth; no hardcoded URL.
- `src/lib/report-plants.functions.ts`: signed-in server function guarded by Report screen access, returns parsed plants or an error.
- `src/routes/_authed.report.tsx`: load plants on mount and pass them to the existing Plant `RangeSelect` in place of `PLANTS`.
- Production: the same endpoint entry must exist in its SAP API Settings, plus a redeploy.
