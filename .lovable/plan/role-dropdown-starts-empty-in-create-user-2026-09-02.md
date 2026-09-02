# Role dropdown starts empty in Create User

## What changes

In **User Management → Create User**, the Role dropdown no longer comes pre-selected with "Initiator".

- The dropdown opens empty, showing the placeholder **"Select a role"**.
- The admin must actively open the dropdown and pick a role (Initiator, Approver, Admin, Viewer, or any custom role).
- If Create is clicked without choosing a role, the existing validation message "Select a role" appears and nothing is submitted.
- The Edit User dialog is unchanged — it still pre-selects the user's current role.

## Technical details

- `src/routes/_authed.admin.users.tsx`:
  - `CreateUserDialog`: change the initial `role` state from `"initiator"` to `""` (line 395) and reset to `""` (instead of `"initiator"`) after a successful create (line 412).
  - The existing `RolePicker` already renders a "Select a role" placeholder when the value is empty, and the existing submit validation already blocks an empty role — no other code changes needed.
