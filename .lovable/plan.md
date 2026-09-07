# Fix Quality backend startup (realtime + auth) and the Windows build

Confirmed from your container logs. No application features, APIs, UI, other Docker projects, Nginx configs, or existing ports are touched.

## 1. Realtime: missing SECRET_KEY_BASE

The realtime service in `deployment/Quality/backend/docker-compose.yml` never receives `SECRET_KEY_BASE`, so the Elixir release aborts during migration boot.

Add to the realtime service environment:

```yaml
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}
      APP_NAME: realtime
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      SEED_SELF_HOST: "true"
      RUN_JANITOR: "true"
      ERL_AFLAGS: "-proto_dist inet_tcp"
```

`SECRET_KEY_BASE` and `VAULT_ENC_KEY` already exist in `.env.example`; the runbook will state they must be filled with real generated values (`openssl rand -hex 32` and `openssl rand -hex 16`).

## 2. Auth: password authentication failed for supabase_auth_admin

The bootstrap file `volumes/db/roles.sql` sets passwords using the `:'pgpass'` psql variable, which is not reliably expanded the way it is mounted, so the internal roles keep unusable passwords and GoTrue cannot run its migrations.

Replace the SQL bootstrap with a shell bootstrap that reads the password from the environment safely:

- Add `volumes/db/00-roles.sh` — a small init script that runs `psql` with `POSTGRES_PASSWORD` passed as a bound value and issues `ALTER ROLE ... WITH PASSWORD` for `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_functions_admin`, `supabase_admin`, `pgbouncer`, and `supabase_read_only_user`, skipping roles that do not exist.
- Mount the init files directly at `/docker-entrypoint-initdb.d/` (not a nested `init-scripts/` subfolder) so the Postgres entrypoint actually executes them, in numeric order.
- Remove the old `roles.sql` variable-expansion approach.

The auth service keeps `GOTRUE_DB_DRIVER: postgres` and gains an explicit `DATABASE_URL` alongside `GOTRUE_DB_DATABASE_URL` for compatibility.

## 3. One-time reset (Quality only)

Init scripts run only on a fresh data volume, and the current volume was created with broken role passwords:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality down -v
docker compose -p nfa-quality up -d
docker compose -p nfa-quality ps
```

Then check each container separately (one command per line):

```bash
docker logs nfa-quality-auth --tail 50
docker logs nfa-quality-realtime --tail 50
```

`down -v` removes only `nfa-quality-*` volumes; the other applications, containers, and volumes on the server are unaffected. Afterwards re-apply the schema with `Quality/scripts/run-migrations.sh`.

## 4. Windows build error: `@tiptap/extension-table` not resolved

Confirmed in the repository: the import is correct and the package is declared in `package.json` and `bun.lock`. There is no npm `package-lock.json`, so `npm ci` is not valid here — the local `node_modules` is simply out of date.

Bun is not installed on the Windows machine, and `node_modules` has already
been deleted. That is why `vite` is now also unavailable. Reinstall all
dependencies with the package manager already installed:

```powershell
npm install
npm run build
```

Do not run `npm run build` before `npm install`; Vite and the TipTap extension
are installed into `node_modules` by that first command. Do not use `npm ci`,
because this checkout currently has no `package-lock.json`.

The installation should create `package-lock.json`. Keep that lockfile with
the project, then `npm ci` can be used for repeatable future Windows and server
deployments. `deployment/Quality/scripts/deploy-quality.sh` will be made
lockfile-aware: use `npm ci` when `package-lock.json` exists, otherwise use
`npm install`.

A successful build produces `dist/`, including `dist/server/index.mjs`.

## 5. Files changed

- `deployment/Quality/backend/docker-compose.yml` — realtime env vars, auth DB URL, corrected init-script mount paths
- `deployment/Quality/backend/volumes/db/00-roles.sh` — new role-password bootstrap
- `deployment/Quality/backend/volumes/db/roles.sql` — removed/replaced
- `deployment/Quality/backend/.env.example` — clarify required generated secrets
- `deployment/README.md` — updated recovery and verification steps
- `deployment/Quality/scripts/deploy-quality.sh` — install command fix

## 6. Verification

Validate the resolved Compose configuration and run shell syntax checks on the new and edited scripts.
