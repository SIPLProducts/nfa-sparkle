# Fix: Subject must show the exact SAP value

## Problem (confirmed)
The Edit dialog loads the live SAP detail response, then overwrites it with a locally
saved draft row. In `RecordEditDialog.tsx` every field is resolved as
`localDraft ?? sapValue`, so an older saved value (`test77`) wins over the value SAP
just returned (`test12`).

## Fix
Make the SAP response the single source of truth for the Edit form:

- When the live SAP detail call succeeds, populate Subject, Scope Impact, Budget Impact,
  Timeline Impact and Detailed Description directly from the SAP response keys
  (`SUBJECT`, `SCOPE_IMPACT`, `BUDGET_IMPACT`, `TIMELINE_IMPACT`, `TEXT`) — no local draft
  merge, no hardcoded fallbacks.
- Only when the SAP call fails (network/middleware error) fall back to the locally saved
  draft, then to the row already shown in the results table, so the dialog is not empty.
- Keep values exactly as SAP returns them (numbers converted to string for the inputs,
  no rounding, no trimming of content).
- Refetch on every open so reopening after an update shows the newest SAP values.

## Technical notes
- File: `src/components/report/RecordEditDialog.tsx`, the effect that runs on dialog open.
- Replace the `data?.field ?? str(sap, "KEY")` precedence with `sap ? str(sap, "KEY") : (draft/row fallback)`.
- Saving a draft and the "Update in SAP" payload builder stay unchanged.
