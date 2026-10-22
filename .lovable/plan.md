# Approval Chain payload: match supplied 15-approver format

## Current state
- Up to 15 approvers can be added/removed in the Approval Chain dialog.
- Create (`create_user`) and Update (`Update_user`) payloads already send `DESIG1..15` / `USERID1..15` from the selected rows, blank for unused slots.
- Difference from the supplied sample: `LINE_INDEX` is still sent, while the sample comments it out.

## Change
- Stop sending `LINE_INDEX` in the Create and Update payloads, so the body matches the supplied format exactly (pspnr, Funct, EXTR_TXT, BEGDA, endda, DESIG/USERID 1-15).
- Delete payload unchanged. Same existing SAP API and method; no hardcoded values.
- Update payload tests to assert 15 slots, selected approvers in order, and no `LINE_INDEX`.

## Technical
- `src/lib/sap-approval-chain.ts`: remove the `createUser["LINE_INDEX"]` line.
- Adjust the existing approval-chain payload test.
