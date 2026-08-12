# User Management: users + custom roles

Extend **Admin → User Management** so you can create roles (like the reference dialog), not just pick from the four fixed ones, and set screen access per role.

## What you get

### Roles tab
- Card/table list of all roles: name, description, "System" badge for built-ins, user count, and how many screens they can open.
- **Create Role** dialog matching the reference: Role Name (required), Description, Create / Cancel.
- Row actions: Edit (name, description), Delete (custom roles only, blocked when users are assigned).
- Built-in roles (Initiator, Approver, Admin, Viewer) are locked: cannot be renamed or deleted, but their screen permissions stay editable.

### Permissions
- The existing screen-access grid now lists every role, including custom ones, with a checkbox per screen (Dashboard, Create NFA, My NFAs, Approvals, E-NFA Report, SAP API Settings, User Management).
- Admin keeps User Management access, so you can never lock yourself out.

### Users tab
- Unchanged flow, but the role picker now shows all roles (built-in + custom) instead of a fixed list of four.

Custom roles control screen access only — they do not appear as approval steps in the NFA workflow.

## Technical details

**Database**
- New `public.app_role_def`: `key` (unique slug), `name`, `description`, `is_system boolean`, timestamps. Seeded with the four existing enum roles marked `is_system = true`.
- New `public.user_role_assignment` (`user_id`, `role_key`) for custom-role assignments; the existing `user_roles` enum table stays as the source of truth for the four system roles so `private.has_role`, RLS policies, and `nfa_act` keep working untouched.
- `role_permission` gains a nullable `role_key text` column so permissions can be stored for custom roles alongside the existing enum rows; unique on (`role_key`, `screen`) for custom rows.
- GRANTs: read to `authenticated`, all to `service_role`; RLS — any signed-in user reads, only admins write via `private.has_role(auth.uid(),'admin')`.

**Server functions** (`src/lib/user-admin.functions.ts`)
- `listRoles`, `createRole`, `updateRole`, `deleteRole` (rejects system roles and roles with assigned users).
- `listManagedUsers` / `createManagedUser` / `updateManagedUser` extended to read/write both `user_roles` (system) and `user_role_assignment` (custom).
- `listRolePermissions` / `saveRolePermissions` extended to handle `role_key` rows.

**UI**
- `src/routes/_authed.admin.users.tsx`: third tab "Roles", new `CreateRoleDialog`, permissions grid driven by fetched roles rather than the static `ROLES` constant.
- `src/lib/screens.ts` keeps `SCREENS` as the single source of screen keys; `ROLES` becomes the system-role seed list only.
- `src/lib/auth-context.tsx` loads assignments from both role tables so `canAccess` respects custom roles in the sidebar and route guards.
