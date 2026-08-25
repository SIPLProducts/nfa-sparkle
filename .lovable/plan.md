# Standalone Supabase stack for the NFA Quality server

Your server already runs two Supabase stacks (`supabase-dev-*` and `supabase-prod-*`) plus two PM2 middlewares. The current `deploy/supabase/docker-compose-quality.yml` is only an *override* file — it has no images, so `docker compose up` on it alone cannot start anything. This replaces it with a complete, self-contained stack that starts with one command and cannot collide with DEV/PROD.

## Port and name conflicts to avoid (from your running containers)

| In use today | By |
| --- | --- |
| 8000, 8443 | supabase-dev-kong |
| 8010, 9443 | supabase-prod-kong |
| 5433, 6543 | supabase-dev-supavisor |
| 5434, 6433 | supabase-prod-supavisor |

Quality will therefore publish only on free, loopback-bound ports:

| Quality service | Host bind |
| --- | --- |
| Kong (API) | 127.0.0.1:54321 → nginx 8001 |
| Studio | 127.0.0.1:54323 → nginx 8082 |
| Postgres | 127.0.0.1:54322 (for psql/migrations) |
| Supavisor pooler | not started (not needed by the app) |

Project name `nfa-quality`, network `nfa-quality-net`, containers `nfa-quality-*`, volumes `nfa-quality-*` — no overlap with `supabase-dev` / `supabase-prod`.

## Files delivered

### 1. `deploy/supabase/docker-compose-quality.yml` — rewritten, standalone

Full stack, images pinned to the exact versions already proven on your box:

`supabase/postgres:15.8.1.085`, `kong/kong:3.9.1`, `supabase/gotrue:v2.186.0`, `postgrest/postgrest:v14.8`, `supabase/realtime:v2.76.5`, `supabase/storage-api:v1.48.26`, `darthsim/imgproxy:v3.30.1`, `supabase/postgres-meta:v0.96.3`, `supabase/studio:2026.04.27-sha-5f60601`, `timberio/vector:0.53.0-alpine`, `supabase/logflare:1.36.1`.

Includes healthchecks, `depends_on: service_healthy` ordering, `restart: unless-stopped`, named volumes for db data and storage files. Analytics (vector + logflare) is put behind an optional profile so the base stack stays light; Studio works without it.

### 2. Config files the stack mounts (new)

- `deploy/supabase/volumes/api/kong.yml` — declarative routes for `/auth/v1`, `/rest/v1`, `/realtime/v1`, `/storage/v1`, `/pg` with anon + service_role key consumers.
- `deploy/supabase/volumes/db/init/*.sql` — role and schema bootstrap (`_supabase` db, `supabase_admin`, `authenticator`, `anon`, `authenticated`, `service_role`, realtime/storage schemas, logs).
- `deploy/supabase/volumes/logs/vector.yml` — only used with the analytics profile.

### 3. `deploy/supabase/.env.quality.example` — corrected

Matched one-to-one with the new compose file. Compared with the `.env` you pasted, these change:

- `POSTGRES_PORT_HOST=54322` (5432 is already taken inside dev/prod networks; publish quality on 54322).
- Pooler variables removed — no supavisor in this stack, and your current `POOLER_PROXY_PORT_TRANSACTION=6543` would clash with `supabase-dev-supavisor`.
- `ANON_KEY` / `SERVICE_ROLE_KEY` in your file still carry `"ref": "nhrwogdnwtkmbygwlrkv"` (the old cloud project ref). They are signed with your new `JWT_SECRET`, so they will work, but the example and README will show regenerating them with `ref=nfa-quality` for clarity.
- Everything else you already set (secrets, `10.200.1.7` URLs, Studio credentials, auth flags) is kept as-is.

### 4. `deploy/supabase/README.md` — rewritten runbook

Written for your actual path, `/opt/Ramky_Applications/NFA-Approval/Quality/backend`:

```text
1. copy compose + volumes + .env into the backend folder
2. docker compose -p nfa-quality up -d
3. docker compose -p nfa-quality ps          # all healthy
4. curl -s http://127.0.0.1:54321/rest/v1/ -H "apikey: $ANON_KEY"
5. deploy/scripts/run-migrations.sh          # port 54322
6. Studio http://10.200.1.7:8082 -> add user -> seed-admin.sql
7. app env + rebuild, then pm2/systemd restart
```

Secret generation commands included verbatim:

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # JWT_SECRET
openssl rand -hex 32    # SECRET_KEY_BASE
openssl rand -hex 16    # VAULT_ENC_KEY
openssl rand -hex 16    # LOGFLARE tokens (x2)
openssl rand -hex 32    # middleware PROXY_SECRET
```

plus a stdlib-only Python snippet that prints `ANON_KEY` and `SERVICE_ROLE_KEY` as HS256 JWTs signed with `JWT_SECRET` (10-year expiry) — no pip install needed.

### 5. `deploy/scripts/run-migrations.sh` — port update

Default Postgres port becomes `54322` to match the quality stack (still overridable with `PGPORT`).

## Notes

- No application source changes; everything lands under `deploy/`.
- Nothing in the plan touches the running DEV/PROD containers, their networks, or their volumes.
- Only placeholders are committed to the repo; the real secrets stay in your server `.env`.
