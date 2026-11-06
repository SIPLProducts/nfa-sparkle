# Plant F4: send CHECK based on Dynamic / Predefined

## What changes for the user
On Create NFA, the Plant list is reloaded whenever the approver option changes:
- **Predefined** selected → Plant request sends `check: "X"` → SAP returns the predefined plants.
- **Dynamic** selected → Plant request sends `check: ""` → SAP returns the dynamic plants.

The Plant dropdown (and the approvers that depend on it) shows whatever SAP returns for that mode. The current plant selection is cleared when the mode changes so a stale plant is never submitted.

## Request body
Built from the Plant F4 body template saved in SAP API Settings (no hardcoded URL):
```text
{ "plant": { "check": "X" | "", "bukrs": "<selected company code>" } }
```
If the saved template still uses the older `cc_code` / `CC_CODE` shape, that shape is kept and only `check` is set by mode — so either template works.

## Technical details
- `src/lib/sap/plant-payload.ts`: `buildPlantF4Payload(template, companyCode, check)` — detects `plant` vs `cc_code` wrapper, sets `check` ("X" Predefined, "" Dynamic) and `bukrs` / `CC_CODE`.
- `src/lib/sap-report.server.ts` `callSapPlantF4(bukrs, check)` and `src/routes/api/public/sap-plant.ts`: accept and pass the `check` value (validated to "X" or "").
- `src/routes/_authed.nfa.new.tsx`: send the current approver mode's check with the Plant request; refetch plants when the mode changes; clear the selected plant on change.
- Tests in `src/lib/sap/plant-payload.test.ts`: Predefined → `check:"X"`, Dynamic → `check:""`, both `plant/bukrs` and `cc_code` templates.
- Update the Plant F4 body template in SAP API Settings to `{"plant":{"check":"X","bukrs":"9000"}}` (Production needs the same).

Nothing else changes: Dynamic/Predefined approver requests, validations, NFA create payload, and other SAP calls stay as they are.
