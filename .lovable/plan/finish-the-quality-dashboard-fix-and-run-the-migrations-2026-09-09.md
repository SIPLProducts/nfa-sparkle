# Finish the Quality dashboard fix and run the migrations

## Where things stand (confirmed from your output)

- The Supabase API is now healthy: `curl http://127.0.0.1:8001/auth/v1/health` returned `200 OK` with the GoTrue response. Auth is working.
- `nfa-quality-meta` was still restarting when you pressed Ctrl+C, so the repair script did not finish its wait loop. Studio reads schemas through Meta, which is why the dashboard still shows the `supabase_admin` error.
- The migration run failed with `password authentication failed for user "postgres"` because the command was pasted verbatim, including the placeholder text `<POSTGRES_PASSWORD from backend/.env>`. That literal string was sent as the password.

## What this plan changes in the repo

1. **`deployment/Quality/scripts/run-migrations.sh`**
   - Read `POSTGRES_PASSWORD` automatically from `backend/.env` when `PGPASSWORD` is not supplied, so no password ever has to be typed or pasted.
   - Refuse an obviously wrong password containing `<` or `>` with a clear message instead of a raw Postgres error.

2. **`deployment/Quality/scripts/fix-db-roles.sh`**
   - Resolve the Quality root from the script's own location, so it runs from any directory.
   - If `meta` is still restarting after the wait loop, print its recent log instead of leaving you guessing.

3. **`deployment/README.md`**
   - Replace the placeholder-style commands with the no-password version so this cannot be mispasted again.

## Steps to run on the server after this change

```text
# 1. Finish the role repair and let it run to completion (do not Ctrl+C)
cd /apps/webapplications/NFA_Approval/Quality
./scripts/fix-db-roles.sh

# 2. If meta is still restarting, look at why
docker logs nfa-quality-meta --tail 50

# 3. Run the migrations - no password needed, it reads backend/.env
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh

# Optional preview of what would run:
# DRY_RUN=1 ./scripts/run-migrations.sh
```

If you prefer to pass the password manually, use the real value from
`backend/.env` in quotes — never the placeholder text in angle brackets.

## Scope guard

Only the two Quality shell scripts and the deployment README change. No application code, no database data, and no other application, container, port, shared config, or volume is touched. The role repair affects only `nfa-quality-db` and restarts only `nfa-quality-auth`, `nfa-quality-realtime`, and `nfa-quality-meta`.
