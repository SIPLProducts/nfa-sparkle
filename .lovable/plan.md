# Restore sidebar screens and User Management on the Quality server

## What the screenshot shows

After login the sidebar is empty and there is no Admin section, and the user badge reads `INITIATOR` for `masteradmin@sharviinfotech.com`.

How the app decides what to show (verified in code):

- `src/lib/auth-context.tsx` reads `role_permission` (`role_key, screen, allowed`) once, and reads the signed-in user's roles from `user_roles` + `user_role_assignment`.
- `src/components/AppShell.tsx` renders each menu item only when `canAccess(screen)` is true.
- If the `role_permission` read returns nothing (empty or blocked), the fallback only shows menus when the user's role list contains `admin`.

So an empty sidebar plus an `INITIATOR` badge means both: the permission rows are not reaching the browser, and the master user is not carrying the `admin` role in the tables the app reads.

## Migration content (verified in the repo)

The repo already contains everything needed — nothing has to be authored:

- `role_permission` is created and seeded with all 7 screens for `initiator`, `approver`, `viewer`, `admin` — including `('admin','user_management',true)` and `('admin','sap_api',true)`.
- A later migration adds `role_permission.role_key` and backfills it from `role`. The app reads `role_key`, so if that later migration did not run, every row has `role_key = NULL` and the app sees zero permissions — exactly the observed blank sidebar.
- `app_role_def`, `user_role_assignment`, and the `profiles` columns (`first_name`, `last_name`, `contact`, `status`) used by the Create User form come from the newest migrations.

Conclusion to confirm on the server: the Quality database is behind on migrations, most likely missing the `role_key` migration and the newest `profiles` columns.

## Steps

1. Diagnose on the Quality database (read-only), to confirm before changing anything:
   - Does `role_permission.role_key` exist and is it populated?
   - Do `app_role_def` and `user_role_assignment` exist?
   - Do `profiles.first_name`, `last_name`, `contact`, `status` exist?
   - Which roles does the master user hold in `user_roles` and `user_role_assignment`?
2. Apply the missing migrations with the existing idempotent runner `deploy/scripts/run-migrations.sh` against the Quality database.
3. Backfill in case an older database already had rows: set `role_key = role::text` wherever it is null, and insert any missing screen rows for the four built-in roles.
4. Grant the master user the `admin` role in both `user_roles` and `user_role_assignment` so the sidebar, Admin section, and the admin checks used by user creation all agree.
5. Sign out and back in on the server so the roles and permissions are re-read.

## Code hardening (in this repo)

- In `src/lib/auth-context.tsx`, capture the `role_permission` query error instead of ignoring it, and log a clear console warning when permissions fail to load, so this situation shows a diagnosable message instead of a silently empty sidebar.
- Keep the existing behaviour otherwise; no change to the permission model.

## Deliverables

- A single SQL script under `deploy/scripts/` that runs the diagnosis, the backfill, and the master-admin grant, safe to re-run.
- A short section in `deploy/README.md` describing this check as part of every deployment.
