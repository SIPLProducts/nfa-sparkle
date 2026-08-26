# Restore User Management access on the Quality server

## Confirmed diagnosis

The latest server output confirms:

- The Quality database is healthy.
- Its actual host connection is `127.0.0.1:5435`, not port `54322`.
- `.env` now says `POSTGRES_PORT_HOST=54322`, but changing `.env` does not alter an already-created container's published port. The running container retains `0.0.0.0:5435->5432` until recreated.
- The master account already has the `admin` role.
- The server's `run-migrations.sh` is an older/different copy because it ignores `MIGRATIONS_DIR`.
- The unhealthy Studio container is a separate issue; the SQL Editor is currently usable and it does not explain the empty application sidebar.

The remaining likely blocker is missing/failed screen permission loading, not authentication or the master role.

## 1. Rotate the exposed password

The database password was pasted into chat. Change it and update backend services that use it. Never place the replacement in frontend/VITE variables or paste it into chat.

## 2. Use the real database port now

Do not recreate the database container merely to change the port during this recovery. Connect to its current published port:

```bash
read -rsp 'Database password: ' PGPASSWORD; echo
export PGPASSWORD

psql -h 127.0.0.1 -p 5435 -U postgres -d postgres \
  -c 'select current_database(), current_user;'

unset PGPASSWORD
```

The equivalent container command is:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
docker compose -f docker-compose-quality.yml exec db \
  psql -U postgres -d postgres -c 'select current_database(), current_user;'
```

Do not run `docker compose down -v`; it deletes database data.

## 3. Verify the exact User Management requirements

Run this in the working SQL Editor:

```sql
SELECT
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
WHERE role_key = 'admin'
ORDER BY screen;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('role_permission', 'user_roles', 'user_role_assignment')
  AND grantee IN ('authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;
```

Required results:

- All three table names are non-null.
- All eight profile columns are returned.
- An `admin / user_management / true` row exists.
- `authenticated` has `SELECT` on all three role/permission tables.

If the `admin / user_management` row is missing, run this data repair in the SQL Editor:

```sql
INSERT INTO public.role_permission (role, role_key, screen, allowed)
VALUES ('admin', 'admin', 'user_management', true)
ON CONFLICT (role_key, screen)
DO UPDATE SET allowed = EXCLUDED.allowed;
```

If an authenticated SELECT grant is missing, run:

```sql
GRANT SELECT ON public.role_permission TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_role_assignment TO authenticated;
```

Then sign out of the application, clear site data for `10.200.1.7:8081`, and sign in again. The app loads role and permission rows during authentication bootstrap.

## 4. Test the browser requests after fresh login

In browser DevTools → Network, inspect these requests:

```text
/rest/v1/user_roles
/rest/v1/user_role_assignment
/rest/v1/role_permission
```

Each must return HTTP 200. If any returns 401, the frontend was built with a backend URL/key that does not match this Quality backend. In that case:

- Correct `/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env`.
- Use the Quality API URL on port `8001` and its matching public/anon key.
- Never use the service-role key in a `VITE_` variable.
- Rebuild the frontend because `VITE_*` values are baked into `dist`.
- Restart `NFA-Portal-App` with updated environment and sign in again.

## 5. Fix the migration script path before applying migrations

Confirm the installed script is stale:

```bash
grep -n 'MIGRATIONS_DIR' \
  /opt/Ramky_Applications/NFA-Approval/Quality/scripts/run-migrations.sh
```

Update it from the current repository version or change its default migration folder to:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations
```

Only if Step 3 shows missing tables or profile columns, run migrations using port `5435`:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/scripts
read -rsp 'Database password: ' PGPASSWORD; echo
export PGPASSWORD

PGPORT=5435 \
MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations \
./run-migrations.sh

unset PGPASSWORD
```

Stop at the first migration error. Do not recreate existing tables or reset the volume.

## 6. Permanent repository fixes

Update deployment tooling to:

- Resolve the frontend at `/Quality/frontend`.
- Resolve migrations at `/Quality/backend/migrations` while preserving overrides.
- Detect the actual Docker-published database port instead of assuming 54322.
- Print resolved app, migrations, environment, and database values in preflight.
- Add clear errors when a stale installed script ignores overrides.
- Log role and permission query failures in the app rather than silently showing an empty sidebar.

The Studio `SNIPPETS_MANAGEMENT_FOLDER` and unhealthy status can be handled separately after User Management access is restored.
