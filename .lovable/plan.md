# Fix the Supabase role passwords directly (no volume wipe) + finish the frontend

Your diagnosis is correct. Two facts make the current situation unfixable by the init script alone:

1. The server still has the old `volumes/db/roles.sql` with the unexpanded `:'pgpass'` variable.
   The replacement (`00-roles.sh`) exists in the repository but was never copied to the server.
2. Even after copying it, **`/docker-entrypoint-initdb.d/` scripts only run when the Postgres data
   directory is empty**. Your `nfa-quality-db` volume already has data, so a new init script would
   be ignored entirely.

So the fastest, safest fix is to set the role passwords directly on the running database. No data
loss, no wipe, no effect on other applications.

---

## Step 1 — Set the role passwords on the live database

Run from the backend folder (substitute your actual `POSTGRES_PASSWORD` from `.env`):

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
source .env

docker exec -i nfa-quality-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v pw="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', rolname, :'pw')
FROM pg_roles
WHERE rolname IN (
  'authenticator','pgbouncer','supabase_admin','supabase_auth_admin',
  'supabase_functions_admin','supabase_read_only_user','supabase_storage_admin'
)
\gexec
SQL
```

Verify a role can actually log in:

```bash
docker exec -i nfa-quality-db \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_auth_admin -d postgres -c 'select 1'
```

That must print `1`. If it errors, the password in `.env` differs from what you just set — re-run
Step 1 with the correct value.

### Important: password characters

`GOTRUE_DB_DATABASE_URL` is a URL. If `POSTGRES_PASSWORD` contains `@ : / # ? %` or spaces, the
URL parses wrongly and you get the same 28P01 error even with a correct password. Use a
hex-only password:

```bash
openssl rand -hex 24
```

If you change it, put the new value in `.env` **and** re-run Step 1, then Step 2.

## Step 2 — Make sure Realtime has its secrets, then restart

```bash
grep -E 'SECRET_KEY_BASE|VAULT_ENC_KEY|JWT_SECRET' .env
```

Any `<placeholder>` must be replaced:

```bash
openssl rand -hex 32   # SECRET_KEY_BASE, JWT_SECRET
openssl rand -hex 16   # VAULT_ENC_KEY
```

Then:

```bash
docker compose -p nfa-quality up -d
docker compose -p nfa-quality ps
docker logs nfa-quality-auth --tail 30
docker logs nfa-quality-realtime --tail 30
docker logs nfa-quality-meta --tail 30
```

All containers should reach healthy/running.

## Step 3 — Load the schema

```bash
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD="$POSTGRES_PASSWORD" ./scripts/run-migrations.sh
```

Then create the first user in Studio (http://10.200.1.7:8082) and run `scripts/seed-admin.sql`.

## Step 4 — Frontend static files

The app logs show `ENOENT ... dist/public/manifest.webmanifest`. The Node server looks for
static files in `dist/public/`:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
mkdir -p public
cp -r assets icons favicon.ico favicon.png manifest.webmanifest public/
pm2 restart enfa-quality-app
```

## Step 5 — Point the app at the backend

`Quality/frontend/.env` must hold the Quality keys:

```
SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
```

`VITE_*` values are baked in at build time — if they change, rebuild on Windows and recopy
`dist/`. Then hard-refresh http://10.200.1.7:8081.

---

## Repository changes I will make

1. **`deployment/Quality/scripts/fix-db-roles.sh`** (new) — the Step 1 command as a reusable,
   idempotent script, so this never needs to be typed by hand again.
2. **`deployment/Quality/backend/docker-compose.yml`** — confirm the GoTrue variables for
   v2.186.0: `GOTRUE_DB_DRIVER=postgres` plus
   `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`
   (this is the correct format; `DATABASE_URL` is also set as a fallback), and add
   `?search_path=auth` where GoTrue expects its own schema.
3. **`scripts/pack-dist.mjs`** — also emit `dist/public/`, so Step 4 is never needed again.
4. **`deployment/README.md`** — replace the "reset the volume" advice with this direct fix, and
   add the password-character warning.

No application source or UI changes.

## Order

Step 1 → verify login → Step 2 → Step 3 → Step 4 → Step 5 → open the site.

If any single command errors, paste that exact output — it identifies the remaining cause
precisely.
