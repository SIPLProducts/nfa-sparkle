# Multiple roles per user with a role switcher

## What the user will see
- **Create User / Edit User**: the single "Role" dropdown becomes a multi-select (checkbox list of the same existing roles). At least one role is still required. Existing users keep their current role pre-selected.
- **Users table**: shows all assigned roles as chips.
- **Top bar**: a "Role" selector next to the user menu, listing only the roles assigned to the signed-in user. Hidden when the user has just one role.
- Switching role immediately changes the sidebar menu and which screens open, using that role's existing screen permissions. The choice is remembered on the device; on first sign-in the first assigned role is used. If the selected role is later removed, it falls back to the first remaining role.

## What stays the same
- Role definitions, Role screen permissions, SAP integrations, payloads, workflow and validations are unchanged.
- No database changes: role assignments are already stored as one row per role, so multiple rows per user already fit.

## Technical details
- `src/routes/_authed.admin.users*.tsx`: replace `RolePicker` single value with a multi-select (`string[]`); send `roles: string[]` to the existing create/update functions (they already insert one `user_role_assignment` row per role via `user-admin.server.ts`).
- `src/lib/auth-context.tsx`: keep loading all assigned roles; add `activeRole`, `setActiveRole` (persisted in localStorage, read in effect), and compute permissions only from `activeRole`. Existing `hasPermission`/screen checks keep their signature.
- `src/components/AppShell.tsx`: add the role selector in the header.
- Server enforcement: a client function middleware sends the active role as an `x-active-role` header; `user-admin.server.ts` screen checks restrict to that role only when it is one of the caller's assigned roles (otherwise current union behavior), so server actions match the selected role.
- Add tests for active-role resolution (fallback when missing/unassigned).
