# Fix empty sidebar and restore User Management on Quality

## Confirmed facts

- The Quality database is healthy and published at `127.0.0.1:5435`.
- The master account has `admin` in `public.user_roles`.
- The header text **Initiator is hardcoded** in `AppShell.tsx`; it does not reflect the logged-in user's actual role.
- Sidebar items are filtered from browser-loaded roles and `role_permission` rows. An empty sidebar means those browser queries are failing or returning no usable roles.
- The server's installed migration script does not match the repository version: it ignores `MIGRATIONS_DIR` and calculates `/Quality/supabase/migrations`.

Do not rerun `seed-admin.sql`; the admin role already exists.

## Diagnose before migrating

In browser DevTools → Network, sign out and sign back in, then inspect:

```text
/rest/v1/user_roles?select=role&user_id=eq...
/rest/v1/user_role_assignment?select=role_key&user_id=eq...
/rest/v1/role_permission?select=role_key%2Cscreen%2Callowed
```

Record the status and response body for each. They must return HTTP 200. A 401 means the built frontend key/session does not match the Quality backend; an empty 200 response points to RLS/policy visibility.

Run this in the working SQL Editor:

```sql
SELECT role_key, screen, allowed
FROM public.role_permission
WHERE role_key = 'admin'
ORDER BY screen;

SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_roles', 'user_role_assignment', 'role_permission')
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_roles', 'user_role_assignment', 'role_permission')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
```

Required:

- `admin / user_management / true` exists.
- Authenticated users can read their own role rows.
- `role_permission` is readable by authenticated users.
- `authenticated` has `SELECT` on all three tables.

## Repair only the confirmed database gap

If only the permission row is missing:

```sql
INSERT INTO public.role_permission (role, role_key, screen, allowed)
VALUES ('admin', 'admin', 'user_management', true)
ON CONFLICT (role_key, screen)
DO UPDATE SET allowed = true;
```

If grants are missing:

```sql
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_role_assignment TO authenticated;
GRANT SELECT ON public.role_permission TO authenticated;
```

Do not add broad anonymous access and do not disable RLS.

## Correct frontend backend configuration if requests return 401

Create the missing runtime/build env file at:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
```

Use the Quality API URL on port `8001` and the matching Quality public/anon key for both server and `VITE_*` public configuration. Never place the service-role key in a `VITE_` variable.

Rebuild because `VITE_*` values are baked into `dist`, then restart the Node app with updated environment. Sign out, clear site data for `10.200.1.7:8081`, and sign in again.

## Fix the application diagnostics and role label

Update the frontend to:

- Show the actual loaded role instead of the hardcoded `Initiator` header text.
- Log and surface failures from `user_roles`, `user_role_assignment`, and `role_permission` queries instead of silently producing an empty sidebar.
- Keep the admin fallback only after a verified admin role has loaded.
- Avoid changing existing access rules or exposing admin navigation to non-admin users.

## Fix deployment scripts permanently

Update repository deployment tooling for the actual Quality layout:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/frontend
/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations
/opt/Ramky_Applications/NFA-Approval/Quality/frontend.env
```

The migration runner will:

- Preserve `MIGRATIONS_DIR` and `PGPORT` overrides.
- Default Quality database access to the currently published port `5435`, or detect it from Docker.
- Print resolved paths and database endpoint before doing work.
- Fail clearly if a stale deployed script ignores the override.

The deploy helper will pass the resolved migration path/port explicitly and use the Quality frontend/env paths.

## Migration safety

Only apply migrations if the SQL checks prove required tables or profile columns are absent. First deploy the corrected migration script, then use:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/scripts
read -rsp 'Database password: ' PGPASSWORD; echo
export PGPASSWORD

PGPORT=5435 \
MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations \
./run-migrations.sh

unset PGPASSWORD
```

Stop on the first error. Never run `docker compose down -v`, recreate tables, or reset the database volume.

## Security cleanup

Rotate the database password that was pasted into chat and update backend services that use it. Do not place the replacement in chat, screenshots, shell history, or frontend variables.
