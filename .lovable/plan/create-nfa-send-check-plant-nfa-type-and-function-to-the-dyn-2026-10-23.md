# Create NFA: send check, plant, NFA Type and Function to the Dynamic Approvals API

## What changes for you
- Both approver options now use your **Dynamic Approvals** API, with this request:
  `{ "get_detail": { "check": "X" | " ", "plant": "<plant>", "nfa_type": "<NFA Type>", "funct": "<Function>" } }`
- **Predefined Approvers** sends `check: "X"`.
- **Dynamic Approvers** sends `check: " "` (a single space, as you asked).
- `plant`, `nfa_type` and `funct` are whatever you picked on the screen. Nothing is hardcoded. A field you haven't picked yet is sent blank.
- SAP is asked again whenever Plant, NFA Type, Function or the approver option changes. SAP's reply is shown the same way it is today, including the ticks, email IDs, the rule of at least 2 approvers, and SAP's message when nothing comes back.

## Not changed
The Create NFA submit payload, the Approval Chain admin screen, Approvals, Print Form, emails and every other API.

## Technical details
- `buildApproverGetDetailPayload(check, plant, nfaType, funct)` in `sap-api-constants.ts` adds `nfa_type` and `funct`. `approverModeCheck`'s Dynamic value is used only for this call, as `" "`. The Create submit `check` stays as it is now.
- Pass `nfaType`/`funct` through `fetchSapApproverChains` → `/api/public/sap-approver-detail` (Zod-validated) → `callApproverGetDetail`.
- `ApproverSelector`: one effect for both modes, keyed on plant, nfaType, functionName and check. Predefined stops calling the old Approval Chain API.
- Update the tests to cover the 4-field payload for X and for the single space.
