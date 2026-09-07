# Get the whole Quality environment working — backend containers + frontend page

Two separate problems remain. Fix the backend first (the login page cannot work without it).

---

## Part A — Backend containers (auth, realtime, meta all failing)

`db` and `imgproxy` are healthy; `auth`, `realtime` and `meta` fail. All three connect to
Postgres with their own role passwords (`supabase_auth_admin`, `supabase_admin`). Those passwords
are set by `volumes/db/00-roles.sh`, which **only runs on a brand-new database volume**. Your
existing `nfa-quality` volume was created before that script existed, so the roles still have the
old/unset passwords — every dependent container fails authentication.

### A1. Confirm the cause (run each separately, do not join with `and`)

```bash
docker logs nfa-quality-meta --tail 40
docker logs nfa-quality-auth --tail 40
docker logs nfa-quality-realtime --tail 40
```

Expect `password authentication failed` / `SECRET_KEY_BASE` style errors.

### A2. Check the env file has real secrets (not placeholders)

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
grep -E 'POSTGRES_PASSWORD|JWT_SECRET|SECRET_KEY_BASE|VAULT_ENC_KEY|ANON_KEY|SERVICE_ROLE_KEY' .env
```

Any value still showing `<...>` must be filled:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD, JWT_SECRET, SECRET_KEY_BASE
openssl rand -hex 16   # VAULT_ENC_KEY
```

`ANON_KEY` and `SERVICE_ROLE_KEY` are JWTs signed with `JWT_SECRET` — generate them at
https://supabase.com/docs/guides/self-hosting#api-keys (roles `anon` and `service_role`).

### A3. Reset only the Quality volumes and restart

This deletes ONLY `nfa-quality-*` volumes. Other applications and their Docker data are untouched.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality down -v
docker compose -p nfa-quality up -d
docker compose -p nfa-quality ps      # all should reach healthy/running
```

### A4. Load the database schema

```bash
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/run-migrations.sh
```

Then create the first user in Studio (http://10.200.1.7:8082) and run `scripts/seed-admin.sql`
for admin rights.

---

## Part B — Frontend "Loading…" page

The app process runs and nginx returns 200, but the app logs show
`ENOENT ... dist/public/manifest.webmanifest` and `dist/public/favicon.png`. The Node server
expects its static files in `dist/public/`; your copy has them at the `dist/` root.

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
mkdir -p public
cp -r assets icons favicon.ico favicon.png manifest.webmanifest public/
pm2 restart enfa-quality-app
pm2 logs enfa-quality-app --lines 20      # ENOENT lines gone
```

Then hard-refresh (Ctrl+Shift+R) http://10.200.1.7:8081.

## Part C — Point the frontend at the Quality backend

The login page will still fail until the app has the Quality keys. Check
`Quality/frontend/.env`:

```
SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env>
VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<same ANON_KEY>
```

The `VITE_*` values are baked in at build time — if you change them you must **rebuild on
Windows** (`npm run build`) and recopy `dist/`. The non-VITE values are read at run time, so a
`pm2 restart enfa-quality-app` is enough for those.

---

## Repository change I will make

`scripts/pack-dist.mjs` will also write the static files into `dist/public/`, so future builds
already contain the folder the Node server needs and Part B never has to be repeated manually.
One matching note goes into `deployment/README.md`.

No other application source changes.

## Order to run

A1 → A2 → A3 → A4 → B → C → open http://10.200.1.7:8081 and log in.

If any step errors, paste that exact error — each one names a specific cause.
