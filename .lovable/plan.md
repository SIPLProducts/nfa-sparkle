# Get the Quality stack fully up — fix the realtime container

## Where we are

The compose file is fixed: it parsed and 8 of 9 containers came up healthy (db, auth, rest, storage, imgproxy, kong, studio, meta). Only one is failing:

```text
✘ Container nfa-quality-realtime  Error dependency realtime failed to start
dependency failed to start: container nfa-quality-realtime is unhealthy
```

Kong waits for realtime to be healthy, so this one container blocks the whole start command from reporting success.

## Step 1 — Read the actual realtime error

```bash
docker logs nfa-quality-realtime --tail 60
```

Send me the output. The three usual causes are below; the log tells us which one it is.

## Step 2 — Check the two realtime-only settings

Realtime is strict about the length of two values in `backend/.env`:

- `SECRET_KEY_BASE` must be exactly 64 characters (`openssl rand -hex 32`)
- `VAULT_ENC_KEY` must be exactly 32 characters (`openssl rand -hex 16`)

Check the lengths without printing the secrets:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
awk -F= '/^SECRET_KEY_BASE=/{print "SECRET_KEY_BASE length:", length($2)}
         /^VAULT_ENC_KEY=/{print "VAULT_ENC_KEY  length:", length($2)}' .env
```

Expected: `64` and `32`. If either is wrong (or still shows placeholder text in angle brackets), generate new ones:

```bash
echo "SECRET_KEY_BASE=$(openssl rand -hex 32)"
echo "VAULT_ENC_KEY=$(openssl rand -hex 16)"
```

Edit `.env` with `nano .env`, replace those two lines, save, then:

```bash
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps realtime
docker logs nfa-quality-realtime --tail 40
```

## Step 3 — Make sure the realtime database schema exists

Realtime needs the `_realtime` schema and a working `supabase_admin` login. The bootstrap SQL only runs on a brand-new volume, so on your existing volume it may be missing:

```bash
docker exec nfa-quality-db psql -U postgres -d postgres -tAc \
  "select count(*) from information_schema.schemata where schema_name='_realtime'"
```

If it returns `0`, create it:

```bash
docker exec -i nfa-quality-db psql -U postgres -d postgres <<'SQL'
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO postgres;
GRANT ALL ON SCHEMA _realtime TO supabase_admin;
SQL
```

Then recreate realtime:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps realtime
```

## Step 4 — Repair the internal role passwords

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/fix-db-roles.sh
```

This reads the password from `backend/.env` itself, applies it to the internal database roles, and recreates only the Quality services.

## Step 5 — Confirm everything is healthy

```bash
docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
curl -i http://127.0.0.1:8001/auth/v1/health
```

All `nfa-quality-*` containers should read `healthy` or `Up`.

## Step 6 — Run the migrations

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh
```

## Step 7 — Dashboard login on port 8082

Studio has no built-in login screen, so the prompt comes from nginx:

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-admin
```

In `/etc/nginx/sites-available/enfa-quality.conf` (or the copy under `/apps/webapplications/NFA_Approval/nginx/`), inside the `server` block with `listen 8082;`, just above `location / {`:

```nginx
    auth_basic           "eNFA Quality dashboard";
    auth_basic_user_file /etc/nginx/enfa-quality-studio.htpasswd;
```

Apply and test:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://10.200.1.7:8082` in a private window — it must ask for `enfa-admin` and your password.

## Fallback if realtime still refuses to start

Your application does not use live/realtime updates, so it is not required for login or the dashboard. If step 1-3 do not resolve it, I can adjust the project compose file so kong no longer waits on realtime — the rest of the stack then starts cleanly and realtime can be sorted out separately. Tell me the log output first; that decides whether the fallback is needed.

## Safety

- Only `nfa-quality-*` containers are touched. The DEV and PROD stacks, their ports and volumes are untouched.
- The `nfa-quality-db-data` volume is reused, so all users, roles and data are preserved.
- No application source code is changed and nothing is built on the Ubuntu server.
