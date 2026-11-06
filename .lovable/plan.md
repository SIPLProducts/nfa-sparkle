# Fix "At least one plant is required" on User Management > Dynamic Approvers

## Root cause (confirmed in code)
The User Management "Dynamic Approvers" tab and the new Create NFA dynamic-approver lookup both call the same server address (`/api/public/sap-dynamic-approvers`). When the Create NFA integration was added, that address was rewritten to only accept a list of plants. The tab still sends an NFA number (`{ nfaNo }`) and expects a list of records back, so the request is rejected with "At least one plant is required" and the "Dynamic Approvers List" SAP entry (`{"dynamic_approvers":""}`) is never called.

## Fix
Make the shared address handle both requests, without changing either one:
- Body contains `plants` → existing Create NFA behavior (unchanged: "Dynamic Approvers" endpoint, `approvers.check=""` payload, Create NFA permission).
- Body contains `nfaNo` (or no plants) → restored list behavior: call the existing `callDynamicApproversList(nfaNo)` (uses the "Dynamic Approvers List" entry and `{"dynamic_approvers": nfaNo}`), parse with `parseDynamicApprovers`, and return `{ records, message }` as the tab expects. Access requires User Management permission.

## Technical details
- Edit only `src/routes/api/public/sap-dynamic-approvers.ts`: accept a union schema (`{ plants: string[] }` | `{ nfaNo?: string }`), branch the permission check (`nfa_new` vs `user_management`) and the SAP call per branch.
- No changes to the tab, Create NFA screen, payload builders, SAP API Settings entries, or workflow email logic.
- Run existing tests (`sap-dynamic-approvers*.test.ts`, `sap-approver-detail.test.ts`).
- Production needs a redeploy after publishing.
