# Standalone Supabase Docker Compose for the NFA Quality server

Today `deploy/supabase/docker-compose-quality.yml` is only an *override* — it assumes you already cloned `supabase/docker` and run it with `-f docker-compose.yml -f docker-compose-quality.yml`. On its own it defines no images, so it cannot start anything. This replaces it with one complete, self-contained stack that runs with a single `docker compose up -d`, fully isolated from your existing VMS DEV/PROD stacks.

## What changes

### 1. `deploy/supabase/docker-compose-quality.yml` (rewritten, standalone)

A full Supabase stack with pinned images and no dependency on the upstream repo:

| Service | Image | Purpose |
| --- | --- | --- |
| db | supabase/postgres | database (127.0.0.1:5432) |
| kong | kong:2.8.1 | API gateway (127.0.0.1:54321) |
| auth | supabase/gotrue | authentication |
| rest | postgrest/postgrest | Data API |
| realtime | supabase/realtime | live subscriptions |
| storage | supabase/storage-api | file storage |
| imgproxy | darthsim/imgproxy | image transforms |
| meta | supabase/postgres-meta | schema API for Studio |
| studio | supabase/studio | dashboard (127.0.0.1:54323) |
| vector + analytics | timberio/vector, supabase/logflare | logs (optional profile) |

Isolation details:
- Explicit `name: nfa-quality` project name and a dedicated `nfa-quality-net` bridge network, so nothing collides with VMS DEV/PROD containers or networks.
- Every container name prefixed `nfa-quality-`.
- Named volumes prefixed the same way (`nfa-quality-db-data`, `-storage-data`).
- All published ports bound to `127.0.0.1` only, on the ports your nginx already expects (54321 Kong, 54323 Studio, 5432 Postgres); nginx keeps publishing 8001/8082/8081/3004.
- `restart: unless-stopped` and healthchecks with `depends_on: condition: service_healthy` so the stack comes up in the right order.

### 2. Supporting config files (new)

Self-hosting needs a few files the upstream repo normally ships:
- `deploy/supabase/volumes/api/kong.yml` — Kong declarative routes for `/auth/v1`, `/rest/v1`, `/realtime/v1`, `/storage/v1`, `/pg`, with the anon/service_role key consumers.
- `deploy/supabase/volumes/db/init/*.sql` — the roles/schema bootstrap Supabase expects (`_supabase` database, `supabase_admin`, `authenticator`, `anon`, `authenticated`, `service_role`, realtime/storage schemas).
- `deploy/supabase/volumes/logs/vector.yml` — only if you keep the analytics profile.

### 3. `deploy/supabase/.env.quality.example` (corrected)

Rewritten to match exactly the variables the new compose file reads — no unused keys, no missing ones. Includes `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `LOGFLARE_*`, dashboard credentials, `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` pointing at `http://<SERVER_IP>:8001`, and pooler/port settings.

### 4. `deploy/supabase/README.md` (rewritten)

Copy-paste Ubuntu runbook:

```text
1. secrets      -> generate JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, others
2. .env         -> cp .env.quality.example .env; edit; chmod 600
3. start        -> docker compose -p nfa-quality up -d
4. verify       -> docker compose ps; curl Kong health
5. migrations   -> deploy/scripts/run-migrations.sh
6. admin user   -> Studio + deploy/scripts/seed-admin.sql
7. app env      -> /opt/enfa/app.env, then rebuild the app
```

### Secret generation commands (included verbatim in the README)

```bash
openssl rand -hex 24                     # POSTGRES_PASSWORD
openssl rand -hex 32                     # JWT_SECRET (40+ chars)
openssl rand -hex 32                     # SECRET_KEY_BASE
openssl rand -hex 16                     # VAULT_ENC_KEY
openssl rand -hex 16                     # LOGFLARE tokens (x2)
openssl rand -hex 32                     # middleware PROXY_SECRET
```

ANON_KEY / SERVICE_ROLE_KEY are HS256 JWTs signed with that same `JWT_SECRET` — a small Python snippet (stdlib only, no pip installs) that prints both keys with `iss=supabase`, `ref=nfa-quality`, 10-year expiry, ready to paste into `.env`.

## Notes

- No application source code changes; everything lands under `deploy/`.
- Images pinned to known-good tags so a later upstream change cannot break the quality server.
- `.env` holds only placeholders in the repo — real secrets stay on the server.
