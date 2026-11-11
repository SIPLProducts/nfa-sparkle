# Fix empty Approval Chain for NFA 100270 (Dynamic)

## Root cause
The request the app sends to SAP is different from the one that works in Postman. The plant gets lost:

- The saved request in SAP API Settings ("Approval flow in Detailed Description") names the plant field **`werks`**.
- The app's request builder only looks for a field called **`plant`**. It can't find one, so it adds a new `"plant"` field. For Dynamic NFAs it also sets that field to blank on purpose.
- So SAP gets `check: ""`, a blank `plant`, and the `werks` value copied from the saved sample (9000), not from the NFA. SAP answers with no approval levels, and the app returns `{"ok":true,"approvers":[]}`.
- Predefined NFAs have the same mismatch: `werks` always stays at the sample's 9000 instead of the NFA's real plant.

The new DATE fields have nothing to do with it. Once SAP returns the record, the response reader already maps DESIG, USERID, APPR, STAT, DATE and TIME for levels 1–15.

## Fix
1. In the approval-flow request builder, write the NFA's plant into the plant field the saved template already uses (`werks` or `plant`, matched ignoring upper/lower case). Add a new field only when the template has neither.
2. Send the real plant in both modes. Dynamic still sends blank `check`, NFA Type and Function, plus `enfa_no`. This matches your Postman request exactly: `{"get_data":{"check":"","werks":"9000","nfa_type":"","funct":"","enfa_no":"100270"}}`.
3. Leave the Predefined request, the saved SAP API Settings, the response reader and the Print Form display as they are.

## Tests
- Update `src/lib/sap-approval-flow-payload.test.ts`:
  - With a `werks` template, the Dynamic request for 100270 equals the Postman body above, with no extra `plant` field.
  - With a `werks` template, a Predefined request sends the NFA's own plant (for example 4000), not the template's 9000.
  - A template that uses `plant` still works.
- Add a parser test using the Postman response (MANDT, PSPNR, DESIG1 "site head", USERID1 "1001", DESIG2 "SCM HEAD", DATE fields). It should return levels with role, User ID and date.

## Technical details
- File: `src/lib/sap-api-constants.ts` (`buildApprovalFlowPayload`): resolve the plant key from `["werks","plant"]`, and stop blanking the plant when `check === ""`.
- No changes to the route, permissions, the database or the middleware. Deploy to Quality and Production afterwards.
