# Remove System Roles from User Management

## Scope
- On **User Management → Roles**, exclude every role marked as a system role from the displayed table.
- Keep custom roles visible with their current user counts, screen counts, Edit, and Delete actions.
- Update the short Roles-tab guidance so it no longer refers to hidden built-in roles.
- Preserve the Create role flow and the existing empty/loading behavior.

## Data and functionality safety
- Make this a display-only change; do not delete or modify role definitions, role assignments, users, permissions, or other saved data.
- Do not change the Users, Screen Permissions, or Approval Chain tabs.
- Keep authentication and role-based access behavior unchanged.

## Verification
- Confirm Admin, Approver, Initiator, Viewer, and any other system-marked roles are absent from the Roles table.
- Confirm custom roles and their existing actions still work.
- Check the User Management screen at desktop and narrow widths, then confirm the app builds cleanly.
