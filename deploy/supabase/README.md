# Self-hosted Supabase for the eNFA QA server

Kong (the API gateway the app talks to) is published on **8001**, Studio on **8082**.
Both go through nginx, so the containers stay bound to localhost.

## 1. Get the stack

```bash
sudo mkdir -p /opt/enfa && sudo chown -R enfa:enfa /opt/enfa
cd /opt/enfa
git clone --depth 1 https://github.com/supabase/supabase supabase-src
cp -r supabase-src/docker /opt/enfa/supabase
cd /opt/enfa/supabase
cp .env.example .env
```

## 2. Generate secrets

```bash
# Postgres password and a 40+ char JWT secret
openssl rand -hex 24        # -> POSTGRES_PASSWORD
openssl rand -hex 32        # -> JWT_SECRET
```

Generate the `ANON_KEY` and `SERVICE_ROLE_KEY` JWTs from that `JWT_SECRET` using
the generator at <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
(roles `anon` and `service_role`, `exp` ~10 years out).

## 3. Edit `/opt/enfa/supabase/.env`

```dotenv
POSTGRES_PASSWORD=<generated>
JWT_SECRET=<generated>
ANON_KEY=<generated anon jwt>
SERVICE_ROLE_KEY=<generated service_role jwt>

# Kong / Studio are proxied by nginx -> keep them on localhost
KONG_HTTP_PORT=54321
KONG_HTTPS_PORT=54322
STUDIO_PORT=54323

# Public addresses (what the browser and Studio use)
SITE_URL=http://<SERVER_IP>:8081
API_EXTERNAL_URL=http://<SERVER_IP>:8001
SUPABASE_PUBLIC_URL=http://<SERVER_IP>:8001
ADDITIONAL_REDIRECT_URLS=http://<SERVER_IP>:8081

DASHBOARD_USERNAME=enfa-admin
DASHBOARD_PASSWORD=<strong password>

# QA: no SMTP configured -> confirm users manually or disable confirmation
ENABLE_EMAIL_AUTOCONFIRM=true
DISABLE_SIGNUP=true
```

Bind the published ports to localhost so only nginx exposes them. Create
`/opt/enfa/supabase/docker-compose.override.yml`:

```yaml
services:
  kong:
    ports:
      - "127.0.0.1:54321:8000/tcp"
  studio:
    ports:
      - "127.0.0.1:54323:3000/tcp"
  db:
    ports:
      - "127.0.0.1:5432:5432"
```

## 4. Start

```bash
cd /opt/enfa/supabase
docker compose pull
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:54321/rest/v1/ -H "apikey: $ANON_KEY" | head
```

## 5. Apply the eNFA schema

All project migrations live in `supabase/migrations/` in this repo, in
chronological filename order.

```bash
cd /opt/enfa/app
export PGPASSWORD='<POSTGRES_PASSWORD>'
for f in supabase/migrations/*.sql; do
  echo "== $f"
  psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$f" || break
done
```

If a migration references `supabase_admin`-only objects, run it as `postgres`
(the default above) and skip any statement that touches the `auth`, `storage`
or `realtime` schemas - those are created by the stack itself.

## 6. Create the QA admin user

In Studio (`http://<SERVER_IP>:8082`) → Authentication → Add user → create the
login with "Auto Confirm". Then grant the role, using the user's UUID:

```sql
insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');
```

(Adjust to the columns of `user_roles` / `profiles` as created by the
migrations - check the table in Studio first.)

## 7. Backups

```bash
docker compose exec -T db pg_dump -U postgres postgres | gzip > /opt/enfa/backups/enfa-$(date +%F).sql.gz
```

Add that to a daily cron entry.
