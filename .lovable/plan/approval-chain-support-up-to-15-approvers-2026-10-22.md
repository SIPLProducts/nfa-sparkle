# Approval Chain: support up to 15 approvers

## What changes for you
- User Management → Approval Chain → Add/Edit now allows up to **15** levels ("0 of 15 levels"); Add level stays enabled until 15.
- Add chain sends `create_user` with `DESIG1..15` / `USERID1..15` exactly like your sample. Selected levels fill the slots in order; unused slots are sent as "".
- Edit (`Update_user`) and Delete (`delete_user`) use the same 15 slots so the chain stays consistent in SAP.
- Chains loaded from SAP now read all 15 slots, so levels 8–15 show up and can be edited.
- Same SAP endpoint, method, login and settings as today. Nothing hardcoded.

## Question on LINE_INDEX
Your sample has `LINE_INDEX` commented out. Plan: keep sending `LINE_INDEX` as today (blank on create, SAP's value on update), since SAP accepted it before. Tell me if Create should leave it out.

## Not changed
Create NFA, Approvals actions, Print Form, emails and other screens keep their current behaviour.

## Technical details
- `src/lib/sap-approval-chain.ts`: `MAX_APPROVAL_LEVELS = 15`; slot loops and validation already use it.
- `src/lib/sap/master.ts` chain parser: loop `1..MAX_APPROVAL_LEVELS` instead of `1..7`.
- `ApprovalChainTab.tsx` already uses the constant — no logic change.
- Update tests to expect `DESIG15`/`USERID15` present and a 15-level chain accepted, 16 rejected.
- Frontend deploy only; no database change.
