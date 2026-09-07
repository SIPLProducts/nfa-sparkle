# Fix: missing Quality middleware server code + nfa-quality-auth unhealthy

Two independent problems, both in the deployment kit only — no application code changes.

## 1. Add the actual middleware server files to the Quality kit

`deployment/Quality/middleware/` currently contains only `.env.example`, `ecosystem.config.cjs`, and `systems.example.json` — the runnable server was never included.

- Copy `middleware/server.js` → `deployment/Quality/middleware/server.js` (the Express proxy; CommonJS, runs with plain `node server.js` — your PM2 config already points at it).
- Copy `middleware/package.json` → `deployment/Quality/middleware/package.json` (deps: express, cors, dotenv).
- Copy `middleware/.gitignore` and `middleware/README.md` for completeness.

If your PM2 ecosystem file references `server.mjs` instead of `server.js`, the delivered ecosystem config will point at `server.js`; either name works, but the file and the PM2 config will be kept consistent.

## 2. Fix `nfa-quality-auth` (GoTrue) failing health checks

Root cause: the `auth` service in `deployment/Quality/backend/docker-compose.yml` has **no database connection settings**. GoTrue needs Postgres to run its auth migrations at startup; without a DB URL it exits and never becomes healthy, which then blocks `kong` → `studio` (dependency chain).

Changes to the `auth` service environment:

```yaml
GOTRUE_DB_DRIVER: postgres
GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-postgres}
```

`supabase_auth_admin` is created with this password by `volumes/db/roles.sql`, which is already mounted — but only on a **fresh** data volume.

Also harden the healthcheck (busybox wget exists in the gotrue image, but add a longer start period so migrations can finish):

```yaml
healthcheck:
  test: wget --no-verbose --tries=1 --spider http://localhost:9999/health || exit 1
  interval: 5s
  timeout: 5s
  retries: 12
  start_period: 20s
```

## 3. One-time reset step on the server (documented in `deployment/README.md`)

If the Quality DB volume was already created by a previous `up` attempt, the init SQL will not re-run and `supabase_auth_admin` may be missing its password. The runbook gets an explicit step:

```bash
docker compose -p nfa-quality down -v        # deletes ONLY nfa-quality volumes
docker compose -p nfa-quality up -d
docker logs nfa-quality-auth --tail 50       # confirm "GoTrue" started
docker compose -p nfa-quality ps             # all healthy
```

`down -v` touches only the `nfa-quality-*` volumes; the existing DEV/PROD stacks are not affected. Since the Quality database is still empty at this stage, nothing of value is lost — migrations are re-applied afterwards with `scripts/run-migrations.sh`.

If auth still fails after the reset, the runbook tells you to check `docker logs nfa-quality-auth` for the exact error and verify `JWT_SECRET` (40+ chars) and `POSTGRES_PASSWORD` are actually set in `.env` (empty values are the other common cause of this symptom).

## Verification

- `bash -n` syntax check on scripts; compose file validated with `docker compose config` if available, otherwise YAML lint.
- No changes to app source, other containers, or existing nginx configs.
