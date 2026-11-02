# Designations: simplify form

Applies to the **Designations** tab only (Departments stays as-is, since both share one component).

## Changes
- Create/Edit Designation window: remove the **Code** box and the **Active** switch; label **Name** becomes **Designation Name** (still required, error text "Designation Name is required").
- Designations list: remove the Code and Status columns; header "Name" becomes "Designation Name".
- View Designation: remove Code and Status rows; "Name" becomes "Designation Name".

## Unchanged
- Saving, editing, deleting, duplicate-name check, search, and the Departments tab.
- Existing designations keep their stored code/active values; new ones save with no code and active = on (current defaults), so nothing that reads designations breaks.

## Technical
- Add optional props to `MasterListTab` (e.g. `nameLabel`, `showCode`, `showActive`, default true/"Name") and pass `nameLabel="Designation Name" showCode={false} showActive={false}` only for designations. Submit payload keeps `code` and `is_active` (empty / existing or true).
