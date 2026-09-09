# Fix the Quality dashboard password error and run migrations

## What is wrong

The role-repair script exists, but the command you ran failed only because you were already inside the `scripts/` folder and used the path `./scripts/fix-db-roles.sh`. The Studio dashboard still shows `password authentication failed for user "supabase_admin"`, which means the Quality database volume holds an older/stale password than the one in `backend/.env`. Migrations cannot be run until that is fixed.

## What this plan changes

1. **Make the scripts runnable from any directory**
   - `deployment/Quality/scripts/fix-db-roles.sh` will locate the Quality root and backend folder from its own location (`BASH_SOURCE`), so it works whether you run it from `/Quality`, `/Quality/scripts`, or anywhere else.
   - `deployment/Quality/scripts/run-migrations.sh` will also check `backend/volumes/migrations` as a fallback, so it finds your files without requiring a manual move first.

2. **Clarify the README commands**
   - `deployment/README.md` sections 3 and 4 will show the exact corrected commands and explicitly warn not to run the script from inside the `scripts/` directory.

3. **No port swap**
   - Keep `8001` as the Supabase API/Kong gateway and `8082` as Supabase Studio. Swapping them would require rebuilding and redeploying the frontend because `VITE_SUPABASE_URL` is baked into the build.

## Steps to execute on the server

```text
# 1. Repair the stale Supabase internal role passwords (Quality only)
cd /apps/webapplications/NFA_Approval/Quality
chmod +x scripts/fix-db-roles.sh
./scripts/fix-db-roles.sh

# 2. Verify the dashboard password error is gone
curl -i http://127.0.0.1:8001/auth/v1/health
# Then open http://10.200.1.7:8082 in a browser and confirm it loads schemas/tables.

# 3. Run the migrations
#    If your files are at backend/volumes/migrations the script will find them automatically.
#    Otherwise move them first:  mv backend/volumes/migrations backend/migrations
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD='<POSTGRES_PASSWORD from backend/.env>' ./scripts/run-migrations.sh

# Optional dry run first:
# DRY_RUN=1 PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/run-migrations.sh
```

## Scope guard

Only the two Quality shell scripts and the README are changed. No application code, no database data, no other application/container/port/shared config or volume is modified. The role repair touches only the `nfa-quality-db` container and restarts only `nfa-quality-auth`, `nfa-quality-realtime`, and `nfa-quality-meta`.
