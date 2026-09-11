# Repair the Quality compose file and turn on the dashboard login

The correct compose file already exists in this project at `deployment/Quality/backend/docker-compose.yml`. The copy on the server has damaged indentation in the `meta` and `studio` sections, which is why validation stops at line 323. Fix those two sections, then add the dashboard username/password prompt on port 8082.

## Step 1 - back up the server file

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
cp docker-compose.yml docker-compose.yml.broken-backup
```

## Step 2 - rebuild the two damaged sections automatically

This removes everything from `  meta:` to just before `  vector:` and writes the correct text back. No other section is touched.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend

python3 - <<'PY'
import re
p = 'docker-compose.yml'
s = open(p).read()

good = '''  meta:
    container_name: nfa-quality-meta
    image: supabase/postgres-meta:v0.96.3
    restart: unless-stopped
    healthcheck:
      test: wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
      interval: 5s
      timeout: 5s
      retries: 10
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: ${POSTGRES_HOST:-db}
      PG_META_DB_PORT: ${POSTGRES_PORT:-5432}
      PG_META_DB_NAME: ${POSTGRES_DB:-postgres}
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - nfa-quality-net

  studio:
    container_name: nfa-quality-studio
    image: supabase/studio:2026.04.27-sha-5f60601
    restart: unless-stopped
    healthcheck:
      test: wget --no-verbose --tries=1 --spider http://localhost:3000/api/profile || exit 1
      interval: 5s
      timeout: 5s
      retries: 10
    environment:
      STUDIO_DEFAULT_ORGANIZATION: ${STUDIO_DEFAULT_ORGANIZATION:-Ramky}
      STUDIO_DEFAULT_PROJECT: ${STUDIO_DEFAULT_PROJECT:-eNFA Quality}
      SUPABASE_URL: http://nfa-quality-kong:8000
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL:-http://localhost:8001}
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
      AUTH_JWT_SECRET: ${JWT_SECRET}
      STUDIO_PORT: 3000
      STUDIO_PG_META_URL: http://nfa-quality-meta:8080
      STUDIO_LOGFLARE_PUBLIC_TOKEN: ${LOGFLARE_PUBLIC_ACCESS_TOKEN}
      STUDIO_LOGFLARE_URL: http://nfa-quality-analytics:4000
      NEXT_PUBLIC_ENABLE_LOGS: "true"
      STUDIO_AUTH_JWT_SECRET: ${JWT_SECRET}
    ports:
      - "127.0.0.1:${STUDIO_PORT:-54323}:3000"
    depends_on:
      kong:
        condition: service_healthy
      meta:
        condition: service_healthy
    networks:
      - nfa-quality-net

'''

start = s.index('\n  meta:\n') + 1
end = s.index('\n  vector:\n') + 1
open(p, 'w').write(s[:start] + good + s[end:])
print('meta and studio sections rewritten')
PY
```

## Step 3 - validate

```bash
docker compose -p nfa-quality --env-file .env config -q
echo "exit code: $?"
```

Continue only when the exit code is `0`.

## Step 4 - restart only the Quality services

```bash
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest realtime storage meta kong studio

for i in $(seq 1 60); do
  S=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nfa-quality-meta)
  echo "meta: $S"; [ "$S" = healthy ] && break; sleep 2
done

docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
docker logs nfa-quality-meta --since 3m --tail 40
```

The password error should be gone because Meta now starts with the repaired password.

## Step 5 - make port 8082 ask for a username and password

Studio has no built-in login, so the prompt must come from the web server in front of it.

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-enfa enfa-admin      # enter the password twice
```

Edit the Quality site file (`/apps/webapplications/NFA_Approval/nginx/enfa-quality.conf` or the matching file in `/etc/nginx/sites-available/`). Inside the `server` block that listens on `8082`, add these two lines directly above the `location /` block:

```nginx
    auth_basic           "eNFA Quality Dashboard";
    auth_basic_user_file /etc/nginx/.htpasswd-enfa;
```

Then apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://10.200.1.7:8082` in a private window - it will now ask for the username and password.

## Step 6 - run the migrations

Do not use `. ./.env`; it contains a line that is not a setting.

```bash
cd /apps/webapplications/NFA_Approval/Quality
PW=$(sed -n 's/^[[:space:]]*POSTGRES_PASSWORD[[:space:]]*=[[:space:]]*//p' backend/.env \
  | tail -n1 | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAqc 'select 1'
PGPASSWORD="$PW" ./scripts/run-migrations.sh
unset PW
```

## Safety

- The database volume, its 10 users and 28 permission rows stay untouched.
- Passwords and API keys are not changed.
- `supabase-dev-*` and `supabase-prod-*` containers are not touched.
- Nothing is rebuilt on the server.
