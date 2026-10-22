# Delete Approval Chain payload: 15 approvers

## Current state
- The Delete body (`delete_user`) already sends MANDT, PSPNR, FUNCT, EXTR_TXT, ISO BEGDA/ENDDA and DESIG1..15 / USERID1..15 from the selected chain, with blanks for unused slots.
- MANDT is filled server-side from the configured SAP system's client (300), not hardcoded in the screen.
- This matches the supplied sample exactly.

## Change
- No change to payload logic, API calls or other features.
- Add a regression test using the supplied sample (2 approvers + 13 blank slots, ISO dates, uppercase keys, no LINE_INDEX) and a 15-approver delete case.

## Technical
- Extend `src/lib/sap-approval-chain-create.test.ts` with Delete cases; run the approval-chain tests.
