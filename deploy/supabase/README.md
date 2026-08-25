# eNFA Quality - standalone self-hosted Supabase

This folder contains a **complete, standalone** Supabase Docker Compose stack for the eNFA Quality environment. It does **not** require cloning the official `supabase/supabase` repository, and it is isolated from the existing VMS DEV/PROD stacks by project name, network, ports and volumes.

## Port map

| Public port | Proxies to | Container bind |
| --- | --- | --- |
| 8001 | Supabase Kong API gateway | 127.0.0.1:54321 |
| 8082 | Supabase Studio | 127.0.0.1:54323 |
| 54322 | Postgres (host-only, for migrations) | 127.0.0.1:54322 |

DEV/PROD already use 8000/8443 and 8010/9443 for Kong, plus 5433/6543 and 5434/6433 for the poolers. Quality deliberately avoids all of them.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose-quality.yml` | Full standalone stack |
| `.env.quality.example` | Environment template |
| `volumes/api/kong.yml` | Kong declarative routes |
| `volumes/db/*.sql` | Database bootstrap (role passwords + internal schemas), runs once on a fresh volume |
| `volumes/logs/vector.yml` | Log shipper (only with `--profile analytics`) |

> Copy the whole `volumes/` folder next to `docker-compose-quality.yml`. Without
> `volumes/db/roles.sql` the internal roles have no password and PostgREST (`rest`)
> never becomes healthy.

## Quick start

All commands assume you are in the quality backend folder, e.g.:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
```

### 1. Generate secrets

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # JWT_SECRET (must be 40+ chars)
openssl rand -hex 32    # SECRET_KEY_BASE
openssl rand -hex 16    # VAULT_ENC_KEY
openssl rand -hex 16    # LOGFLARE_PUBLIC_ACCESS_TOKEN
openssl rand -hex 16    # LOGFLARE_PRIVATE_ACCESS_TOKEN
```

Generate `ANON_KEY` and `SERVICE_ROLE_KEY` as HS256 JWTs signed with the same `JWT_SECRET`. Run this Python snippet (stdlib only, no pip install):

```python
import base64, hashlib, hmac, json, time

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def jwt(role, secret):
    header = b64url(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    now = int(time.time())
    payload = {
        "iss": "supabase",
        "ref": "nfa-quality",
        "role": role,
        "iat": now,
        "exp": now + 315576000   # ~10 years
    }
    body = b64url(json.dumps(payload).encode())
    signing = f"{header}.{body}".encode()
    sig = b64url(hmac.new(secret.encode(), signing, hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

secret = "<PASTE_JWT_SECRET_HERE>"
print("ANON_KEY=" + jwt("anon", secret))
print("SERVICE_ROLE_KEY=" + jwt("service_role", secret))
```

### 2. Create the env file

```bash
cp deploy/supabase/.env.quality.example .env
chmod 600 .env
```

Edit `.env` and fill in every `<...>` placeholder. Important:

- Replace `<SERVER_IP>` with the LAN IP of the quality server (the same one nginx uses).
- `POSTGRES_PORT_HOST=54322` is fixed — do not change it to 5432 or it will clash with DEV/PROD.
- `ANON_KEY` / `SERVICE_ROLE_KEY` must be signed with the exact `JWT_SECRET` you put in this file.

### 3. Copy the compose and config files

```bash
cp deploy/supabase/docker-compose-quality.yml docker-compose-quality.yml
cp -r deploy/supabase/volumes ./volumes
```

### 4. Start the stack

```bash
docker compose -p nfa-quality -f docker-compose-quality.yml up -d
```

Wait for all services to become healthy:

```bash
docker compose -p nfa-quality -f docker-compose-quality.yml ps
```

### 5. Verify the API gateway

```bash
source .env
curl -s http://127.0.0.1:54321/rest/v1/ \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
```

You should get an empty JSON array `[]` or a schema response — not 401 or 404.

### 6. Apply the eNFA schema

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
PGPASSWORD='<POSTGRES_PASSWORD>' ./deploy/scripts/run-migrations.sh
```

The migration script defaults to port `54322` for the quality stack.

### 7. Create the first admin user

Open Studio at `http://<SERVER_IP>:8082`, sign in with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`, then:

- Go to **Authentication → Add user**
- Create the login and tick **Auto Confirm User**

Grant the admin role using the user's email:

```bash
PGPASSWORD='<POSTGRES_PASSWORD>' psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v admin_email="'admin@ramky.com'" \
  -f deploy/scripts/seed-admin.sql
```

### 8. Update the app environment and rebuild

Edit `/opt/enfa/app.env` (or your quality app env file):

```dotenv
SUPABASE_URL=http://<SERVER_IP>:8001
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_PROJECT_ID=nfa-quality

VITE_SUPABASE_URL=http://<SERVER_IP>:8001
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=nfa-quality
```

Then rebuild and restart:

```bash
cd /opt/enfa/app
set -a; . /opt/enfa/app.env; set +a
npm ci && npm run build
sudo systemctl restart enfa-app
```

Remember: `VITE_*` values are baked into the browser bundle at build time. Changing them requires a rebuild, not just a restart.

## Optional: enable analytics

To start Logflare/Vector for log aggregation, add the `analytics` profile:

```bash
docker compose -p nfa-quality -f docker-compose-quality.yml --profile analytics up -d
```

Without the profile, analytics containers are not started and Studio works normally.

## Useful commands

```bash
# View all quality containers
docker compose -p nfa-quality -f docker-compose-quality.yml ps

# Follow logs
docker compose -p nfa-quality -f docker-compose-quality.yml logs -f

# Stop everything (keeps volumes)
docker compose -p nfa-quality -f docker-compose-quality.yml down

# Stop and remove volumes (WARNING: deletes the database)
docker compose -p nfa-quality -f docker-compose-quality.yml down -v

# Restart one service
docker compose -p nfa-quality -f docker-compose-quality.yml restart kong
```

## Backups

```bash
mkdir -p /opt/enfa/backups
docker compose -p nfa-quality -f docker-compose-quality.yml exec -T db \
  pg_dump -U postgres postgres | gzip > /opt/enfa/backups/enfa-quality-$(date +%F-%H%M).sql.gz
```

Schedule this in cron for daily backups.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Bind for 0.0.0.0:54321 failed` | Another service is using the port. Check `docker ps` and `ss -tlnp`. |
| `Invalid API key` | `ANON_KEY` / `SERVICE_ROLE_KEY` were not signed with the `JWT_SECRET` in `.env`. Regenerate them. |
| `401 Unauthorized` from app | App env still points at the old cloud Supabase URL/key. Update `/opt/enfa/app.env` and rebuild. |
| Studio shows `An error has occurred` | Kong or meta is not healthy. Check `docker compose ... logs kong meta`. |
| Postgres port 5432 clashes | You changed `POSTGRES_PORT_HOST` to 5432. Set it back to 54322. |
