# Stop the Dynamic Approvers API from running in Create NFA

## Why it still runs
On the Create NFA screen, the "Budgeted" option is the old dynamic approver mode. When a company is picked, the Approvers box calls the Dynamic Approvers API with all of that company's plants. That call is what you see in the network log.

## What changes
- **Budgeted:** no approver request goes out. The Approvers box stays empty and shows a short note that no approvers apply.
- **Non Budgeted (Approval Chain):** stays exactly as it is now: same request, same display and same selection.
- Company, Plant, NFA Type/Function rules, validations, the submit request and all other API calls stay the same.

## Technical details
- `src/components/nfa/ApproverSelector.tsx`: in non-predefined mode (`check !== "X"`), skip the request completely. Remove the `fetchSapDynamicApprovers` call and its import, keep `chains` empty and render a plain message. Leave the predefined branch exactly as it is.
- Leave the `sap-dynamic-approvers` route, the admin tab and the email chain code in place, because they are not part of the Create flow.
- Check that the tests pass and that no `sap-dynamic-approvers` request fires on `/nfa/new`.
