# Restore User Management access on the Quality server

## Confirmed diagnosis

The latest screenshot confirms:

- `masteradmin@sharviinfotech.com` already has the `admin` role in `public.user_roles`.
- The SQL Editor is successfully connected to the Quality database.
- The `SNIPPETS_MANAGEMENT_FOLDER` notification affects only saved SQL snippets; it is unrelated to authentication, roles, or User Management.

Therefore, do **not** run `seed-admin.sql` again. The two shell errors have separate causes:

1. `connection refused` on `127.0.0.1:54322` means the database container is not publishing that host port, is stopped/unhealthy, or uses a different configured host port.
2. The server's installed `run-migrations.sh` is an older/different copy. It ignored the supplied `MIGRATIONS_DIR` and still used `/Quality/supabase/migrations`. The repository version supports the override, but that is not the version currently running on the server.

The admin role is already correct. After the database checks below, sign out and back in so the browser reloads roles and permissions.

## 1. Rotate the exposed database password

The database password was pasted into chat. Change it before continuing and update the Quality backend configuration/services that use it. Do not paste the replacement password into chat, screenshots, shell history, or frontend variables.

## 2. Find the actual database container and host port

Run these read-only commands:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend

docker compose -f docker-compose-quality.yml ps
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'quality|postgres|db'
ss -ltnp | grep -E ':5432|:54322'
grep -E '^(POSTGRES_PORT_HOST|POSTGRES_PORT)=' .env 2>/dev/null
```

Expected for the repository configuration:

```text
nfa-quality-db ... 127.0.0.1:54322->5432/tcp
```

If `nfa-quality-db` is stopped or unhealthy, inspect/start only that service:

```bash
docker compose -f docker-compose-quality.yml logs --tail=100 db
docker compose -f docker-compose-quality.yml up -d db
```

Do **not** run `docker compose down -v`; that deletes database data.

If the container is healthy but no host port is shown, inspect the resolved Compose configuration:

```bash
docker compose -f docker-compose-quality.yml config | grep -A8 -n 'published\|target: 5432'
```

Use the published host port shown there instead of assuming `54322`.

## 3. Confirm database access

With the discovered port, test without embedding the password in the command:

```bash
read -rsp 'Database password: ' PGPASSWORD; echo
export PGPASSWORD
psql -h 127.0.0.1 -p <ACTUAL_HOST_PORT> -U postgres -d postgres \
  -c 'select current_database(), current_user;'
unset PGPASSWORD
```

If no host port is published, query through the running container:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
docker compose -f docker-compose-quality.yml exec db psql -U postgres -d postgres \
  -c 'select current_database(), current_user;'
```

## 4. Verify User Management requirements

The admin role is already present, so run only these checks in the SQL Editor:

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
```

Required result:

- All three table names are non-null.
- All eight profile fields are returned.
- `admin / user_management / true` exists.

If these results exist, migrations are not the current blocker. Sign out, clear stored site data for `10.200.1.7:8081` if needed, and sign in again. The app loads roles during authentication bootstrap, so an old session/tab can retain the earlier UI state.

## 5. Fix the installed migration script before applying migrations

First prove the installed script is stale:

```bash
grep -n 'MIGRATIONS_DIR' \
  /opt/Ramky_Applications/NFA-Approval/Quality/scripts/run-migrations.sh
```

It should contain:

```bash
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"
```

Update the server script from the current repository deployment, or permanently default it to:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations
```

Only if Step 4 shows missing schema, run migrations with both verified values:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/scripts
read -rsp 'Database password: ' PGPASSWORD; echo
export PGPASSWORD

PGPORT=<ACTUAL_HOST_PORT> \
MIGRATIONS_DIR=/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations \
./run-migrations.sh

unset PGPASSWORD
```

Stop on the first migration error. Do not reset the database volume or recreate existing tables.

## 6. Repository deployment hardening

Update the deployment scripts so future Quality deployments:

- Resolve the app at `/Quality/frontend`.
- Resolve migrations at `/Quality/backend/migrations`, while preserving explicit overrides.
- Validate the real database host port before migration.
- Print resolved app, migrations, environment file, and database endpoint during preflight.
- Fail clearly when an installed script ignores an override.
- Log role/permission query failures in the app instead of silently rendering an empty sidebar.

The separate `frontend.env` issue must be fixed before running the full deployment script, but it is not needed for the already-running app to recognize the existing admin role after a fresh login.
