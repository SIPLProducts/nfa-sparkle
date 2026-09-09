# Permanently fix the Quality dashboard database login

## Confirmed cause

The screenshot shows that the dashboard can open, but its schema service cannot sign in as `supabase_admin`.

The current repair script has two gaps:

1. It reads `POSTGRES_PASSWORD` from the already-running database container. If `backend/.env` was changed after the database volume was created, that container can still hold the old value, so the script resets `supabase_admin` to the wrong password again.
2. It uses `docker compose restart` for Meta/Auth/Realtime. A restart does not reload changed values from `backend/.env`, so Meta may continue trying the stale password.

## Changes

1. **Correct `scripts/fix-db-roles.sh`**
   - Read the intended `POSTGRES_PASSWORD` directly from the Quality `backend/.env` without printing it.
   - Use the database container’s local trusted connection only to set all internal role passwords to that intended value.
   - Recreate only the affected Quality services (`auth`, `rest`, `realtime`, `storage`, `meta`, `kong`, and `studio`) so they reload the current environment; do not stop or alter any other application or Docker project.
   - Before declaring success, test an actual TCP login as `supabase_admin`, then check Meta health and print focused logs if either verification fails.
   - Keep the command runnable from either the Quality root or the `scripts` folder.

2. **Update the Quality deployment guide**
   - Replace the ambiguous recovery steps with one copy-paste sequence.
   - Explain that the updated script must first be copied to the server; running an older server copy will repeat the same problem.
   - Add final checks for the Meta container and dashboard schema endpoint before migrations are run.

## Exact server procedure after the update

```text
cd /apps/webapplications/NFA_Approval/Quality

# Copy the updated fix-db-roles.sh from the project release into Quality/scripts first.
chmod +x scripts/fix-db-roles.sh
./scripts/fix-db-roles.sh

# Only after the script reports a successful supabase_admin login and healthy Meta:
./scripts/run-migrations.sh
```

Then reload `http://10.200.1.7:8082` and click **Reload schemas**. The script will stop with relevant logs instead of reporting success if the dashboard connection is still unhealthy.

## Safety boundary

No data volume is deleted or recreated. The repair changes only built-in database-role passwords inside `nfa-quality-db` and recreates only containers belonging to the `nfa-quality` project. Existing applications, non-Quality containers, ports, data, and volumes remain untouched.
