# Show Companies in Company Code order

Nothing is missing: all 58 companies are still saved, each with its code. The list sorts by Company Name. Before, every name started with its code, so the list looked like it was in code order. Now that the codes are gone from the names, the list sorts alphabetically. "ADIPL-RAMKY JV" (1125) comes first, and 1000 Ramky Infrastructure Ltd moves further down.

## Change
- Sort the Companies tab by Company Code (1000, 1101, 1102, ...).
- Departments and Designations stay sorted by name.
- Nothing else changes.

## Technical details
- In `src/lib/master-lists.functions.ts`, the list function orders by `code` when the kind is `companies` and by `name` for the others.
