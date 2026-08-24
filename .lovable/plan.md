# Ubuntu QA deployment: docs + nginx config

Goal: run the eNFA portal on a single Ubuntu QA server with self-hosted Supabase, reached by IP and port (no domain, plain HTTP).

## Port map

| Port | Service |
| ---- | ------- |
| 8081 | eNFA app (nginx vhost -> Node server on 127.0.0.1:3000) |
| 8001 | Supabase API gateway (Kong) |
| 8082 | Supabase Studio |
| 3004 | SAP middleware (nginx vhost -> Node on 127.0.0.1:3005) |

Only 8081, 8001, 8082, 3004 are opened in UFW; the Node processes themselves bind to localhost and are fronted by nginx.

## Files I will add to the repo

- `deploy/README.md` — the full step-by-step QA deployment guide
- `deploy/nginx/enfa-qa.conf` — one nginx file with all four server blocks
- `deploy/systemd/enfa-app.service` — app service (Node, port 3000, env file)
- `deploy/systemd/enfa-middleware.service` — SAP middleware service (port 3005)
- `deploy/env/app.env.example` — server env vars for the app
- `deploy/supabase/README.md` — self-hosted Supabase notes (docker compose port overrides, key generation, schema/data migration)

No application source code changes.

## What the guide will cover

1. Prerequisites: Ubuntu 22.04/24.04, Node 20, nginx, Docker + compose plugin, UFW rules.
2. Self-hosted Supabase: clone `supabase/docker`, set `.env` (Kong HTTP port 8001, Studio port 8082, POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, dashboard user/password), `docker compose up -d`, verify.
3. Schema + data: apply the project's SQL migrations from `supabase/migrations` to the new instance with `psql`, then create the QA admin user.
4. Build the app: `npm ci && npm run build`, run the built server output with the env file, keep it alive with systemd.
5. Env values for the app pointing at the new backend (`VITE_SUPABASE_URL` / `SUPABASE_URL` = `http://<server-ip>:8001`, publishable + service role keys from step 2). Note that `VITE_*` values are baked in at build time, so a key change means a rebuild.
6. SAP middleware: copy `middleware/`, `npm install`, create `.env` (PORT=3005, PROXY_SECRET) and `systems.json` with the SAP host/client/user, enable the systemd unit. Then in the app: Admin > SAP API Settings > Middleware Configuration -> URL `http://<server-ip>:3004`, same proxy secret, Test middleware.
7. Nginx install/enable, `nginx -t`, reload.
8. Verification checklist and log locations (`journalctl -u enfa-app`, `docker compose logs`, `/var/log/nginx/`).
9. Update procedure (pull, build, restart) and a short troubleshooting table (502, 401 invalid proxy secret, SAP timeouts, CORS).

## Nginx behaviour

- Each vhost: `listen <port>;`, `server_name _;`, proxy_pass with `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers, WebSocket upgrade headers.
- `client_max_body_size 25m` on the app and middleware vhosts (base64 attachment uploads).
- `proxy_read_timeout`/`proxy_send_timeout` 180s on the app and middleware vhosts, because some SAP attachment calls take ~95s.
- Supabase vhosts (8001/8002-studio) proxy to the Kong/Studio containers on their local docker ports.

## Notes

- Plain HTTP by IP means Supabase keys travel unencrypted on the LAN; acceptable for internal QA, and the guide will flag it plus how to add TLS later.
- Studio on 8082 will be restricted by an nginx `allow`/`deny` IP block that you fill in with your office range.
