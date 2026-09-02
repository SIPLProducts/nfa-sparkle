# Roles field as a single-select dropdown

## What changes

In the **Create user** and **Edit user** dialogs (User Management), the Roles field changes from the current checkbox grid to a compact **single-select dropdown** listing all available roles (Admin, Approver, Initiator, Viewer, plus any custom roles defined in the Roles tab).

- Create user: dropdown defaults to "Initiator"; a role must be chosen before submitting.
- Edit user: dropdown opens with the user's current role pre-selected; choosing a different one replaces their role on save.
- Everything else — the users table role badges, screen permissions, approval chain, and all other dialogs/fields — stays exactly as it is.

## Technical details

- `src/routes/_authed.admin.users.tsx`:
  - Replace the `RolePicker` checkbox grid with a shadcn `Select` dropdown fed by the existing `useRoleDefs()` query (shows role `name`, submits role `key`).
  - `CreateUserDialog`: state changes from `roles: Role[]` to a single `role: Role` (default `"initiator"`); submit sends `ROLE: role` instead of `roles.join(",")`; required validation when empty.
  - `EditUserDialog`: same change; pre-selects `user.roles[0]` and falls back to empty (prompting a choice) when the user has no role.
- No backend changes: `createManagedUserForAdmin` / `updateManagedUser` already accept a comma-separated `ROLE` string, and `applyRoles` replaces the user's roles with the provided list — a single key flows through unchanged.
