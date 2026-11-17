# Show Approval Chain Valid From / Valid To as DD.MM.YYYY

## What changes
- In User Management > Approval Chain, the saved-chains list currently shows SAP's raw dates (e.g. "Valid 20261001 → 99991231").
- Show them in the same format as the date fields in the form: "Valid 01.10.2026 → 31.12.9999".
- Blank or invalid dates still show "—".

## What stays the same
- SAP still sends and receives BEGDA/ENDDA as YYYYMMDD. Payloads, validation and saving don't change.

## Technical details
- `src/components/admin/ApprovalChainTab.tsx`: add a small `formatSapDate(yyyymmdd)` helper that uses the existing date-fns `parse`/`format`, and use it in the list line (around line 333).
