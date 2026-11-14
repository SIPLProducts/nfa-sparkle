# Budgeted approvers from the creator's Series

## Finding
The rule you describe is already in the latest build: the Approvers list now uses the **creator's own Series**, not the selected Company. Your screenshot (only "varun yadav", Series 9000, for Company 9000) comes from the older Company-based version still live on enfa.siplproducts.com. The latest build has not been published yet.

With the latest build, the Series 9101 users in User Management give:
- Signed in as **prasad** (Series 9101): SIPL_QM, 22007746, 2026, kvvk, 9001 are listed. **pradeep** is left out because he also has the Admin role. prasad himself is left out.
- The same logic works for any Series. A Series 9000 creator sees only Series 9000 users (today that is varun yadav).

## Steps
1. Keep the current logic: creator's Series, then every active user with the same Series, minus Admins and the creator. Approver order and approver names sent to SAP stay as they are.
2. Small fix: the box heading still says "Order follows the Approval Chain". For Budgeted, change it to "Select approvers from your Series. Selection order sets the approval level."
3. Publish so enfa.siplproducts.com runs the new version. After that, also deploy to Quality and Production with the usual pull and deploy steps. No database changes are needed.
4. Check by signing in as a Series 9101 non-Admin user, choosing Budgeted, Company and Plant, then opening Approvers.

## Unchanged
Non Budgeted flow, SAP payloads, validations (including minimum 2 approvers), and all other screens.
