# Separate System and Custom Roles

## Scope

- Add two sub-tabs inside **User Management → Roles**:
  - **System Roles** — shows the existing Admin, Approver, Initiator, and Viewer roles.
  - **Custom Roles** — shows all non-system roles.
- Default the Roles section to **System Roles** so the restored roles are immediately visible.
- Keep system roles read-only and protected: display their role name, description, user count, and screen count without Edit or Delete actions.
- Keep **Create role**, Edit, and Delete available only within **Custom Roles**, preserving the current custom-role workflow.
- Show the same table structure in both sub-tabs, with an appropriate empty state when a section has no rows.

## Data Safety

- Make presentation-only changes in the Roles screen.
- Do not rename, delete, recreate, or modify any saved role record, role key, assignment, permission, user, or other data.
- Preserve the current duplicate-name protection for reserved system-role names.
- Leave Users, Screen Permissions, Approval Chain, and all other portal behavior unchanged.

## Verification

- Confirm all four system roles appear under System Roles with their existing counts and no modification controls.
- Confirm custom roles appear under Custom Roles and retain Create, Edit, and Delete behavior.
- Confirm switching between the two sub-tabs does not trigger data changes.
- Check the Roles section at desktop and narrow widths, then confirm the app passes its build check.
