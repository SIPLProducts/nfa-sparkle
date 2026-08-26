# Restore User Management access on the Quality server

## Confirmed diagnosis

The migration files are **not missing**. They are located at:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations
```

The migration script calculates its default location as:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/supabase/migrations
```

That path mismatch causes the “No migrations directory” error.

The `frontend.env` warning is a separate deployment configuration issue. It does not assign roles and is not the direct reason the current logged-in user is shown as `INITIATOR`.

The screenshots show that authentication succeeds, but the master account is being treated as an initiator. User Management is permission-gated and is enabled for the `admin` role, so the immediate recovery is to verify the role tables and grant this existing account the admin role.

## 1. Diagnose the Quality database first

Run this from the server and enter the database password when prompted:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

Then run:

```sql
\set ON_ERROR_STOP on

SELECT
  to_regclass('public.user_roles') AS user_roles,
  to_regclass('public.role_permission') AS role_permission,
  to_regclass('public.app_role_def') AS app_role_def,
  to_regclass('public.user_role_assignment') AS user_role_assignment;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'username', 'employee_id', 'department',
    'first_name', 'last_name', 'contact', 'status', 'is_active'
  )
ORDER BY column_name;

SELECT role_key, screen, allowed
FROM public.role_permission
WHERE screen = 'user_management'
ORDER BY role_key;

SELECT u.id, u.email, ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('masteradmin@sharviinfotech.com');
```

Expected results:

- All four table names are non-null.
- The profile query returns all eight fields.
- `role_permission` contains `admin / user_management / true`.
- The master account currently shows `initiator`, explaining the current UI.

Exit with:

```sql
\q
```

## 2. Grant the existing master account admin access

The repository already includes an idempotent script for this. Run:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality

PGPASSWORD='<POSTGRES_PASSWORD>' psql \
  -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v admin_email="'masteradmin@sharviinfotech.com'" \
  -f /opt/Ramky_Applications/NFA-Approval/Quality/scripts/seed-admin.sql
```

It adds the `admin` role without removing the existing `initiator` role.

Verify it:

```bash
PGPASSWORD='<POSTGRES_PASSWORD>' psql \
  -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT u.email, r.role FROM auth.users u JOIN public.user_roles r ON r.user_id=u.id WHERE lower(u.email)=lower('masteradmin@sharviinfotech.com') ORDER BY r.role;"
```

Then sign out completely and sign in again. The Admin section, including User Management, should be available.

## 3. Apply migrations from their actual folder only if diagnosis finds missing schema

Do not create duplicate manual tables. Use the migration files already on the server:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/scripts

MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations \
  ./run-migrations.sh
```

Important: run this step only if Step 1 reports missing tables/columns. The script records applied files in `public.schema_migrations_applied`; if the database was initialized by a different mechanism, the first run may encounter objects that already exist. In that case, stop at the first error rather than modifying or deleting existing tables, and reconcile the migration history before continuing.

The migration files that provide User Management include:

- `20260812060010...sql`: screen permissions and `is_active`
- `20260812061227...sql`: role definitions, assignments, and `role_key`
- `20260812123128...sql`: User ID / username login
- `20260814105347...sql`: employee ID and department
- `20260825114401...sql`: first and last name
- `20260825120139...sql`: contact and status

## 4. Correct deployment script paths for future releases

Update the deployment scripts so this folder layout is supported permanently:

- Default `MIGRATIONS_DIR` to `/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations`, while preserving the environment-variable override.
- Default `APP_DIR` to `/opt/Ramky_Applications/NFA-Approval/Quality/frontend`.
- Keep the frontend runtime environment in `/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env`, or pass its actual location explicitly with `ENV_FILE=...`.
- Add preflight output showing the resolved app, migration, and env paths before deployment begins.

Until that repository update is deployed, use explicit variables:

```bash
APP_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/frontend \
ENV_FILE=/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env \
MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations \
/opt/Ramky_Applications/NFA-Approval/Quality/scripts/deploy-quality.sh
```
