# Roles as a multi-select dropdown (Create User and Edit User)

## What changes
- The Role field in both Create User and Edit User becomes a single dropdown button.
- Opening it shows every role with a checkbox; tick as many as needed. The list stays open while ticking.
- The button shows the chosen roles as small labels (e.g. "Admin", "Approver"); with nothing chosen it reads "Select roles". Each label has a small x to remove it.
- A search box at the top of the list helps when there are many roles.

## What stays the same
- At least one role is still required; same error message.
- Edit User still opens with the user's current roles ticked.
- Saving, the role switcher in the top bar, screen permissions, and all other fields are untouched.

## Technical details
- Rewrite only the shared `RolePicker` component in `src/routes/_authed.admin.users.tsx` (used by both dialogs) using existing Popover + Command + Checkbox UI pieces. Same `value`/`onChange` props, so no caller, payload or server change.
