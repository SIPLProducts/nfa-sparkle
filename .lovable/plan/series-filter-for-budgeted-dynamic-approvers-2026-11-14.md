# Series filter for Budgeted (Dynamic) Approvers

## What changes
1. **Series filter dropdown** at the top of the Approvers dialog, listing every Series configured in User Management > Company > Series. Shown to all roles. Defaults to the creator's own Series.
2. **Filtered list**: picking a Series shows only active users assigned to that Series (Admins and the creator still excluded).
3. **Level-wise view of selected approvers**: below the list (and in the Approvers card), selected approvers appear as Level 1, Level 2, ... in the order they were ticked. Removing one renumbers the rest.
4. Selections made under one Series stay selected when switching to another Series.

## Unchanged
Non Budgeted / Predefined flow, "at least 2 approvers" check, approver names and levels sent to SAP, all other fields and APIs.

## Technical details
- `src/lib/series-approvers.functions.ts`: add a guarded server function returning all series from `company_series`; let the approver lookup accept an optional series (default = caller's series).
- `src/components/nfa/ApproverSelector.tsx`: add Select filter, refetch on change, render ordered "Level N" list from existing selection array.
- Add tests for series filtering and level ordering.
