# Plant field: switch to the new SAP Plant API

## What changes for the user
On Create NFA, after picking a Company, the Plant list loads from the new SAP API and shows the returned plant codes (e.g. 1000, 1001). Nothing else on the screen changes.

## Steps
1. **Plant F4 endpoint settings** (Admin → SAP API Settings → Plant F4): set
   - URL path: `/e-nfa/enfa_approval/APPROVAL`, query `sap-client=300`, on the existing SAP system `http://10.200.1.2:8000`
   - Method: POST
   - Body template: `{ "cc_code": { "check": "X", "CC_CODE": "" } }`
   Credentials and the endpoint record itself are kept as they are.
2. **Request body**: the Plant request currently always sends `{ "plant": { "bukrs": <company> } }`. Change it so it sends the new shape, filling `CC_CODE` with the selected company code and keeping `check` from the template (default `"X"`):
   ```text
   { "cc_code": { "check": "X", "CC_CODE": "1000" } }
   ```
   Any extra keys in the template are preserved; the old `plant` key is no longer added.
3. **Response**: `[{ "WERKS": "1000" }, { "WERKS": "1001" }]` is already understood by the existing plant reader. With no name in the response, each option shows its code. No change needed; add a test confirming it.
4. **Tests**: payload builder test (company 1000 → exact body above) and response test (two plants 1000, 1001).

## Not touched
Company, NFA Type, Function, approvers, submit payloads, validations and all other APIs.

## Technical details
- Extract the Plant body builder from `callSapPlantF4` in `src/lib/sap-report.server.ts` into a pure helper (e.g. `buildPlantF4Payload(template, companyCode)`) so it can be tested.
- Update the `sap_endpoint` row named "Plant F4" (path, query, method, request_body) in the database; give the matching SQL for the Production server.
- Production also needs a redeploy for the payload change.
