# Approval Chain: date pickers for Valid From / Valid To

## What changes
In User Management > Approval Chain, the "Valid From *" and "Valid To *" text boxes become calendar date pickers (button showing the chosen date as DD.MM.YYYY, opening a calendar popup).

## What stays the same
- Values are still stored and sent to SAP as `YYYYMMDD` (e.g. 20261114) — payloads unchanged.
- Existing required checks ("Valid From is required" / "Valid To is required") unchanged.
- Editing an existing chain shows its saved dates preselected in the calendar.
- All other fields, save/delete, and the chain list are untouched.

## Technical details
- `src/components/admin/ApprovalChainTab.tsx`: replace the two `Field` inputs (lines 212-213) with a small `DateField` using shadcn Popover + Calendar (`pointer-events-auto`), converting `YYYYMMDD` <-> `Date` with date-fns `parse`/`format`; invalid/blank values show "Pick a date".
