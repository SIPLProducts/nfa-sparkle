# User Management (Admin)

A single admin-only screen at **Admin → User Management** where you can create users, manage roles, and control which screens each role can access.

## What you get

### 1. Users tab
- Table of all users: name, email, roles (badges), created date.
- Search by name/email.
- **Create user** dialog: Full name, Email, Temporary password, Roles (multi-select: Initiator, Approver, Admin, Viewer). User is created already email-confirmed so they can sign in immediately.
- Row actions: **Edit** (full name, roles), **Reset password**, **Deactivate / Reactivate**.

### 2. Roles & Permissions tab
- One row per role (initiator, approver, admin, viewer).
- Checkbox grid of app screens: Dashboard, Create NFA, My NFAs, Approvals, E-NFA Report, SAP API Settings, User Management.
- Each screen can be toggled per role; saving updates access immediately.
- Admin always keeps User Management access (guard so you cannot lock yourself out).

### 3. Enforcement
- The sidebar only shows screens the signed-in user's roles allow.
- Protected routes redirect to the dashboard when access is not granted.
- Every user/role write is validated server-side against the admin role, so the UI is convenience, not the security boundary.

## Technical details

**Database migration**
- `public.role_permission` (`role app_role`, `screen text`, `allowed boolean`, timestamps, unique on role+screen), GRANT select to `authenticated`, all to `service_role`; RLS: any signed-in user can read, only admins write (`private.has_role`).
- Seed default rows: all roles get Dashboard; initiator gets Create NFA / My NFAs; approver gets Approvals; viewer gets E-NFA Report; admin gets everything.
- `public.profiles` gains `is_active boolean not null default true`.

**Server functions** — new `src/lib/user-admin.functions.ts`, same shape as `sap-api.functions.ts` (`requireSupabaseAuth` + `assertAdmin`, `supabaseAdmin` imported inside handlers):
- `listUsers`, `createUser` (Auth Admin `createUser` + roles insert), `updateUser` (name, role set), `resetUserPassword`, `setUserActive` (Auth `banned_until` + `profiles.is_active`).
- `listRolePermissions`, `saveRolePermissions`.

**Routes / UI**
- `src/routes/_authed.admin.users.tsx` with `Tabs` (Users / Roles & Permissions), shadcn `Table`, `Dialog`, `Checkbox`, `Badge`, sonner toasts, TanStack Query for fetch/mutate.
- `src/lib/screens.ts`: single source of truth mapping screen key → label + route path.

**Access wiring**
- `auth-context` loads role permissions alongside roles and exposes `canAccess(screenKey)`.
- `AppShell` nav filters by `canAccess`; admin routes guard on it.
