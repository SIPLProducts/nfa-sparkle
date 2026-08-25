# Quality-server deployment kit (nginx + docker compose + env + migrations)

Adds the exact files you asked for to the existing `deploy/` folder, using the same port map already documented (8081 app, 8001 Supabase API, 8082 Studio, 3004 middleware).

## Files to add

- `deploy/nginx/nfa-quality.conf` — single nginx file with four server blocks:
  - 8081 → app (Node 127.0.0.1:3000), `client_max_body_size 25m`, 200s proxy timeouts, websocket upgrade headers
  - 8001 → Supabase Kong (127.0.0.1:54321), 50m body, realtime websocket support
  - 8082 → Supabase Studio (127.0.0.1:54323), IP allow/deny block for admin access
  - 3004 → SAP middleware (127.0.0.1:3005), 200s timeouts for slow SAP attachment calls
- `deploy/supabase/docker-compose-quality.yml` — compose override for the self-hosted Supabase stack: binds Kong, Studio and Postgres to 127.0.0.1 only (54321 / 54323 / 5432) so nginx is the only public surface, plus restart policies.
- `deploy/supabase/.env.quality.example` — full Supabase stack env: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, port overrides, `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` pointing at `http://<SERVER_IP>:8001`, dashboard credentials, `ENABLE_EMAIL_AUTOCONFIRM=true`, `DISABLE_SIGNUP=true`.
- `deploy/env/app.env.quality.example` — app runtime + build env (HOST/PORT, `SUPABASE_URL`, publishable key, service role key, and the matching `VITE_*` build-time values) with a note that `VITE_*` requires a rebuild when changed.
- `deploy/env/middleware.env.quality.example` — `PORT=3005`, `PROXY_SECRET`, `ALLOW_IPS`, `TIMEOUT_MS=180000`.
- `deploy/scripts/run-migrations.sh` — idempotent migration runner: applies all 32 files in `supabase/migrations/` in filename order via `psql` with `ON_ERROR_STOP=1`, records applied files in a `public.schema_migrations_applied` tracking table so re-runs skip what already ran, and prints a summary.
- `deploy/scripts/seed-admin.sql` — creates the first admin role row for a given auth user UUID.
- `deploy/scripts/deploy-quality.sh` — one-shot helper: pull code, `npm ci`, build with env sourced, run migrations, restart `enfa-app` and `enfa-middleware`.

## Docs update

`deploy/README.md` gets a short section pointing at the new quality-named files (which file goes where, and the order to run them), keeping the existing guide intact.

## Notes

- No application source code changes.
- Plain HTTP over LAN IP; the README already flags that keys travel unencrypted and how to add TLS later.
- Secrets are placeholders only — nothing real is committed.
