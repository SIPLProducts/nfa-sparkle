# Fix: missing Quality middleware server code + nfa-quality-auth unhealthy + build error

Three issues, all in the deployment kit / local environment — no application logic changes.

## 1. Add the actual middleware server files to the Quality kit

`deployment/Quality/middleware/` currently contains only `.env.example`, `ecosystem.config.cjs`, and `systems.example.json` — the runnable server was never included.

- Copy `middleware/server.js` → `deployment/Quality/middleware/server.js` (the Express proxy; runs with `node server.js` — the PM2 ecosystem config already points at it).
- Copy `middleware/package.json` → `deployment/Quality/middleware/package.json` (deps: express, cors, dotenv).
- Copy `middleware/.gitignore` and `middleware/README.md` for completeness.

## 2. Fix `nfa-quality-auth` (GoTrue) failing health checks

Root cause: the `auth` service in `deployment/Quality/backend/docker-compose.yml` has **no database connection settings**. GoTrue needs Postgres to run its auth migrations at startup; without a DB URL it exits and never becomes healthy, which then blocks `kong` → `studio` (dependency chain).

Changes to the `auth` service environment:

```yaml
GOTRUE_DB_DRIVER: postgres
GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-postgres}
```

`supabase_auth_admin` is created with this password by `volumes/db/roles.sql`, which is already mounted — but only on a **fresh** data volume.

Also harden the healthcheck (add start_period so migrations can finish):

```yaml
healthcheck:
  test: wget --no-verbose --tries=1 --spider http://localhost:9999/health || exit 1
  interval: 5s
  timeout: 5s
  retries: 12
  start_period: 20s
```

## 3. One-time reset step on the server (documented in `deployment/README.md`)

If the Quality DB volume was already created by a previous `up` attempt, the init SQL will not re-run. The runbook gets an explicit step:

```bash
docker compose -p nfa-quality down -v        # deletes ONLY nfa-quality volumes
docker compose -p nfa-quality up -d
docker logs nfa-quality-auth --tail 50       # confirm GoTrue started
docker compose -p nfa-quality ps             # all healthy
```

`down -v` touches only the `nfa-quality-*` volumes; existing DEV/PROD stacks are not affected. The Quality database is still empty, so nothing of value is lost — migrations are re-applied afterwards with `scripts/run-migrations.sh`.

If auth still fails after the reset, check `docker logs nfa-quality-auth` for the exact error and verify `JWT_SECRET` (40+ chars) and `POSTGRES_PASSWORD` are set in `.env`.

## 4. Build error: `Rolldown failed to resolve import "@tiptap/extension-table"`

Verified: `@tiptap/extension-table` (and all other tiptap packages) **are** already listed in `package.json`. The failure is on your Windows machine only — its `node_modules` was installed before the table extension was added, so the package simply isn't on disk there. No code change needed; on your build machine run:

```powershell
npm ci          # fresh install from package-lock.json
npm run build   # now succeeds and produces dist/
```

Yes — after a successful `npm run build`, the `dist/` folder is generated (static frontend at its root, Node server in `dist/server/index.mjs`, assembled by `scripts/pack-dist.mjs`).

## Verification

- `docker compose config` / YAML validation of the compose change.
- `bash -n` syntax check on scripts.
- No changes to app source, other containers, or existing nginx configs.
