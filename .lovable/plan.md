# Approvers popup: add search

## What changes
- A search box appears above the approver table in Create NFA → Approvers popup (Budgeted / Dynamic users list — where many users appear — and also the Predefined list).
- Typing filters rows by **User ID, Name, Department or Designation** (case-insensitive, partial match).
- If nothing matches, the table shows "No approvers match your search."
- Search only hides rows from view: already-selected approvers stay selected, keep their level numbers (#1, #2…), and still appear in "Selected approvers (level-wise)".
- Search is cleared when Company/Plant/Range changes.

## Unchanged
Approver loading, selection order, minimum-approver validation, payloads, SAP calls, Predefined single-chain behavior and all other UI.

## Technical details
- `src/components/nfa/ApproverSelector.tsx`: add `search` state + `Input` with search icon; extend the existing `rows` filter with a match against `a.userId`, `details[a.userId]?.name`, `details[a.userId]?.department`, `a.role`. Selection still uses original indexes `i`, so `checked`/`selected` are unaffected.
- Small pure helper `matchesApproverSearch` in `src/lib/` with a unit test (matches each of the four fields; empty query matches all).
