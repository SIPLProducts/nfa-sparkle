# Create NFA: load approvers from SAP "get_detail" API

## What changes for you
- On Create NFA, once a Plant is chosen, the Approvers window loads approvers from SAP using your new API:
  - GET `/e-nfa/enfa_report//create?sap-client=300`
  - Body: `{ "get_detail": { "check": "<X or blank>", "plant": "<selected plant>" } }`
- `check` follows the Approver Selection: Predefined = `"X"`, Dynamic = `""`. Plant is the selected Plant. Nothing hardcoded.
- SAP's reply (rows with PSPNR, FUNCT, EXTR_TXT, DESIG1..15 / USERID1..15) is read for all 15 levels. The row matching the selected NFA Type (FUNCT) and Function (EXTR_TXT) is shown; ticks, email IDs and "Selected sequence" work as today.
- The ticked approvers continue to go into the Create NFA payload (design1..15 / approve1..15 + check) exactly as now.
- SAP host, login and method come from Admin → SAP API Settings. You register this API there with the name **"Approver Get Detail"** (path above, method GET).
- If SAP returns nothing or the API isn't registered, the window shows the SAP message / "No approval chain configured" and the screen stays usable.

## Not changed
Create NFA submit payload, Approval Chain admin screen, Approvals, Print Form, emails and all other APIs.

## Technical details
- `src/lib/sap-report.server.ts`: add `callApproverGetDetail({ check, plant })` resolving the endpoint by exact name "Approver Get Detail" (fallback `ilike '%get detail%'`), never by path (paths are shared). Sends `{ get_detail: {...} }` with the row's method.
- New route `src/routes/api/public/sap-approver-detail.ts`: same bearer check as `sap-approval-chain`, requires `nfa_new` access, validates input with Zod, unwraps middleware envelope, returns SAP JSON.
- `src/lib/sap-approval-flow.ts`: add `fetchSapApproverDetail({ plant, nfaType, functionName, check })` reusing `parseApprovalChains` (already 1..15) and the same plant/type/function matching.
- `ApproverSelector.tsx`: accept `check` prop; call the new fetcher (refetch when plant/type/function/check change). `_authed.nfa.new.tsx` passes `approverModeCheck(approverMode)`.
- Add a test for the payload builder (check X/blank, plant) and parsing the sample response (5 levels).
- Website deploy plus one API Settings row; no database migration.
