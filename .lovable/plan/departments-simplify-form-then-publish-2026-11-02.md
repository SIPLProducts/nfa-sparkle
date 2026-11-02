# Departments: simplify form, then publish

## Changes
- Departments tab gets the same treatment as Designations: remove **Code** and **Active** from Create/Edit, remove the Code and Status columns from the table and from View, and rename **Name** to **Department Name** (still required, message "Department Name is required").
- Saving, editing, deleting, duplicate-name check and search are unchanged. Existing departments keep their stored code/active values; new ones save as active.
- Then publish so the live site shows both Departments and Designations without Code/Active.

## Technical
- One-line change: pass `nameLabel="Department Name" showCode={false} showActive={false}` to the Departments `MasterListTab` (props already exist).
