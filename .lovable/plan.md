# Fix Quality server migrations and empty sidebar

## What is actually wrong

### 1. Why migrations do not run

The migrations exist here:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/migrations
```

But the installed server script still looks here:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/supabase/migrations
```

It also ignores the `MIGRATIONS_DIR=...` value you pass. Therefore, repeating the same command cannot work. The installed `run-migrations.sh` must be replaced/fixed first.

### 2. Why the earlier database command failed

The Quality database is healthy, but Docker publishes it on port **5435**, not 54322:

```text
0.0.0.0:5435 -> container 5432
```

Any direct `psql` command must therefore use `-p 5435` for this currently running stack.

### 3. Why the SQL Editor shows a red error

The SQL itself did run—the screenshot shows **21 result rows**. The red “API error communicating with the server” and snippets warning are from the unhealthy Studio container/Studio support APIs. They are not proof that the SQL query failed.

### 4. Why the sidebar is empty

The account already has the `admin` role. The app sidebar depends on browser requests to `user_roles`, `user_role_assignment`, and `role_permission`. One of those browser requests is failing or returning no usable data. Also, the header word “Initiator” is hardcoded and is not the actual database role.

## Implementation

### Deployment scripts

- Update `run-migrations.sh` to default to `/Quality/backend/migrations` and honor `MIGRATIONS_DIR`.
- Detect/use the Docker-published database port, currently 5435, while preserving `PGPORT` overrides.
- Update `deploy-quality.sh` for the actual `/Quality/frontend`, `/Quality/backend/migrations`, and `/Quality/frontend.env` layout.
- Print resolved paths and ports before running so wrong copies are obvious.

### Frontend role diagnostics

- Replace the hardcoded “Initiator” label with the actual loaded role.
- Handle and report errors from all three role/permission queries instead of silently rendering an empty sidebar.
- Preserve the current role-based access rules.

## Immediate next diagnostic

Do not run migrations again yet. In the browser app at port 8081:

1. Open DevTools → Network.
2. Sign out and sign back in.
3. Check these three requests:

```text
/rest/v1/user_roles
/rest/v1/user_role_assignment
/rest/v1/role_permission
```

Send the HTTP status and response text for each failing request. This identifies whether the sidebar is blocked by the frontend key/session or by database policy visibility.

In the SQL Editor, run only this single query by itself:

```sql
SELECT role_key, screen, allowed
FROM public.role_permission
WHERE role_key = 'admin'
ORDER BY screen;
```

The required row is:

```text
admin | user_management | true
```

Do not run more migration or grant SQL until this result and the three browser responses are known.

## Security cleanup

Rotate the database password pasted into chat and update only backend services that use it. Never place it in a `VITE_` variable.
