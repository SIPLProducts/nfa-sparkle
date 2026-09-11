# Correct the Quality Docker Compose file and restart the dashboard

The database itself is now correct: the repaired `supabase_admin` login returned `1`, and all 28 permission rows exist. The current failure is in `docker-compose.yml`, so Meta and Studio were never recreated with the repaired password.

## Confirmed YAML errors

The pasted file has these exact problems:

1. `meta.healthcheck` starts at the left margin instead of being indented under `meta`.
2. The Meta `test:` and `interval:` settings are joined on one line.
3. `studio.healthcheck` starts at the left margin instead of being indented under `studio`.
4. The Studio `test:` and `interval:` settings are joined on one line.
5. `STUDIO_DEFAULT_ORGANIZATION` and `STUDIO_DEFAULT_PROJECT` are joined on one line.

These explain `yaml: ... mapping values are not allowed in this context`.

## 1. Back up and replace the broken Meta and Studio blocks

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
cp docker-compose.yml docker-compose.yml.before-yaml-fix
nano docker-compose.yml
```

Replace the complete `meta:` and `studio:` sections with the following. Preserve the spaces exactly:

```yaml
  meta:
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
```

Keep the following `vector:` section unchanged.

## 2. Validate the complete file before restarting

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env config -q
echo "compose validation exit code: $?"
```

Do not continue unless there is no YAML error and the exit code is `0`.

## 3. Recreate only Quality services

```bash
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest realtime storage meta kong studio
```

Then wait and inspect:

```bash
for i in $(seq 1 60); do
  STATE=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nfa-quality-meta)
  echo "meta: $STATE"
  [ "$STATE" = healthy ] && break
  sleep 2
done

docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
docker logs nfa-quality-meta --since 3m --tail 50
```

The fresh Meta log should no longer show password authentication failures.

## 4. Run migrations without sourcing `.env`

The earlier `Quality: command not found` shows that `.env` includes non-variable text. Do not use `. ./.env`.

```bash
cd /apps/webapplications/NFA_Approval/Quality
PW=$(sed -n 's/^[[:space:]]*POSTGRES_PASSWORD[[:space:]]*=[[:space:]]*//p' backend/.env \
  | tail -n1 | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

test -n "$PW" || { echo 'POSTGRES_PASSWORD was not found'; exit 1; }
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAqc 'select 1'
PGPASSWORD="$PW" ./scripts/run-migrations.sh
unset PW
```

The connection test must return `1`; then migrations should run without asking for a password.

## 5. Verify the dashboard

```bash
curl -i http://127.0.0.1:8001/auth/v1/health
curl -i http://127.0.0.1:8082/
docker logs nfa-quality-meta --since 2m --tail 30
```

Reload `http://10.200.1.7:8082`. Users, schemas, and tables should now load.

## Safety

- Do not delete or recreate the database volume.
- Do not change the working password or API keys.
- Do not touch `supabase-dev-*` or `supabase-prod-*` containers.
- Do not rebuild the application.
