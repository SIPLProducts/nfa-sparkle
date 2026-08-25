# Fix: nfa-quality-rest unhealthy on first startup

The stack fails because two independent problems hit the `rest` (PostgREST) and `imgproxy` containers.

## What is actually wrong

1. **Database roles have no password.** The compose file has no database bootstrap SQL. A fresh `supabase/postgres` volume creates the internal roles (`authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_admin`) but nothing sets their passwords to `POSTGRES_PASSWORD`. PostgREST connects as `authenticator` and is rejected, so it never becomes healthy — and `kong` + `storage` then abort because they depend on it. The official self-hosted stack does this with init scripts mounted into `/docker-entrypoint-initdb.d`, which this file is missing.
2. **Healthchecks use tools that don't exist in those images.** `postgrest/postgrest` and `darthsim/imgproxy` are minimal images without `wget` or `curl`, so `wget --spider ...` fails/hangs regardless of whether the service is fine. That is why `imgproxy` sat in "Waiting" for 49s.
3. **Port collision.** `KONG_HTTPS_PORT` defaults to `54322`, the same host port already used by Postgres (`POSTGRES_PORT_HOST=54322`).

## Changes

**New DB bootstrap files** under `deploy/supabase/volumes/db/`, mounted read-only into the `db` service at `/docker-entrypoint-initdb.d/`:
- `roles.sql` — set passwords for `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_admin`, `supabase_read_only_user` from `POSTGRES_PASSWORD`.
- `realtime.sql` — create the `_realtime` schema owned by `supabase_admin`.
- `webhooks.sql` / `logs.sql` — create `supabase_functions` and `_analytics` schemas so realtime/analytics start cleanly.

**`deploy/supabase/docker-compose-quality.yml`**
- Mount the init scripts on the `db` service and pass `POSTGRES_PASSWORD` through so the SQL can use it.
- Replace the `rest` healthcheck: enable PostgREST's admin server (`PGRST_ADMIN_SERVER_PORT=3001`) and use a check the image supports; if none is reliable, drop the healthcheck and make `kong`/`storage` depend on `service_started` instead.
- Replace the `imgproxy` healthcheck with `imgproxy health` (the binary's own command).
- Change the Kong HTTPS host port default from `54322` to `54324`.
- Loosen `kong`'s `analytics` dependency so it never blocks when the analytics profile is off.

**`deploy/supabase/.env.quality.example` and `README.md`**
- Document `KONG_HTTPS_PORT=54324`.
- Add the required reset step: because init scripts only run on an empty data directory, the existing half-created volume must be removed once before restarting.

## Commands you will run on the server

```text
docker compose -p nfa-quality -f docker-compose-quality.yml down -v
# copy updated docker-compose-quality.yml + volumes/db/*.sql
docker compose -p nfa-quality -f docker-compose-quality.yml up -d
docker compose -p nfa-quality -f docker-compose-quality.yml ps
```

`down -v` deletes the Quality database volume only (project `nfa-quality`); the DEV/PROD stacks are untouched. The database is empty at this point, so nothing of value is lost — migrations are applied afterwards with `deploy/scripts/run-migrations.sh`.
