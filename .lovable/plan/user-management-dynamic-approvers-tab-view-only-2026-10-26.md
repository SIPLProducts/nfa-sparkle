# User Management: Dynamic Approvers tab (view only)

## What you will see
- A new **Dynamic Approvers** tab in User Management, next to Approval Chain.
- It lists the dynamic approvers SAP has saved for each NFA. You get one card per NFA number (REFFLD), with Level, Designation, User ID and the user's name or email when that user is in the portal, the same as the Approval Chain cards.
- A search box: leave it blank to load all NFAs, or type an NFA number to load just that one. There is also a Refresh button.
- If SAP returns nothing or an error, SAP's message appears in place of an empty screen.
- The tab only shows data. You can't add, edit or delete anything from it.

## SAP API setup
- The app uses a new SAP API Settings entry called **Dynamic Approvers List** (GET `/e-nfa/enfa_report//create?sap-client=300`, Basic login). A setup step registers it by copying the system and login from your existing Dynamic Approvals entry, so nothing is hardcoded.
- The request body is `{ "dynamic_approvers": "" }` for all NFAs, or `{ "dynamic_approvers": "<NFA no>" }` for one.
- Your **Dynamic Approvals** entry goes back to the `get_detail` body, so Create NFA approvers keep working. The app already builds that body itself.

## Not changed
Users, Roles, Screen Permissions, Approval Chain, Create NFA, approvals, emails and every other API.

## Technical details
- `src/lib/sap-api-constants.ts`: add the endpoint name and `buildDynamicApproversListPayload(nfaNo)`.
- `src/lib/sap-dynamic-approvers.ts`: a pure parser that turns rows into `{ nfaNo, levels[1..15] }` and skips blank slots.
- `src/lib/sap-report.server.ts`: `callDynamicApproversList`, which looks up the endpoint by name.
- `src/routes/api/public/sap-dynamic-approvers.ts`: requires a bearer token and User Management screen access, validates the NFA number with Zod, and returns the parsed rows.
- `src/components/admin/DynamicApproversTab.tsx`, plus a tab entry in `_authed.admin.users.tsx`.
- Migration: register the endpoint as an upsert by name, plus a Quality copy `9900_dynamic_approvers_list.sql`.
- Tests: payload shape and parser (the sample with REFFLD 100190 gives 2 levels).
