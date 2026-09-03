# ENFA Approval — Quality deployment kit (rebuilt) + step-by-step document

Replace the current `deploy/` folder with a new `deployment/` kit shaped exactly like the server layout you described, scoped to the **Quality** environment, plus a single Ubuntu runbook you can follow command by command. Production gets the same shape later by copying Quality and shifting ports — the kit will include a short note on that, but no Production files are written now.

## 1. Remove the old kit

The existing `deploy/` folder targets `/opt/enfa/...` and mixes QA/quality files (`deploy/nginx/enfa-qa.conf`, `deploy/systemd/*`, `deploy/env/app.env.example`). It will be deleted in full and replaced. Nothing under `deploy/` is referenced by application source, so the app is unaffected. Nothing is deleted on your server — only in this repo.

## 2. New repo layout (mirrors the server 1:1)

```text
deployment/
├── README.md                          full Ubuntu runbook (the document)
├── PORTS.md                           port discovery + allocation table
├── nginx/
│   └── enfa-quality.conf              vhosts for Quality only
└── Quality/
    ├── backend/
    │   ├── docker-compose.yml         standalone Supabase stack, project nfa-quality
    │   ├── .env.example               stack secrets + ports (copy to .env)
    │   └── volumes/
    │       ├── api/kong.yml
    │       └── db/{roles,realtime,logs,webhooks}.sql
    ├── frontend/
    │   └── .env.example               VITE_* build env (dist/ is produced by build)
    ├── middleware/
    │   ├── .env.example               PORT, PROXY_SECRET, TIMEOUT_MS, MAX_BODY
    │   ├── systems.example.json       SAP hosts/clients/users
    │   └── ecosystem.config.cjs       PM2 app `enfa-quality-middleware`
    └── scripts/
        ├── run-migrations.sh          idempotent, applies supabase/migrations/*.sql
        ├── seed-admin.sql             grant admin role to first login
        └── deploy-quality.sh          build → publish dist → migrate → reload/restart
```

Server target for every file: `/apps/webapplications/NFA_Approval/…` with the same subpaths. All scripts default to that root (overridable by env var).

## 3. Isolation guarantees (existing apps untouched)

- Docker project name `nfa-quality`, network `nfa-quality-net`, containers `nfa-quality-*`, volumes `nfa-quality-*` — no name collision with `supabase-dev-*` / `supabase-prod-*`.
- Every container publishes on `127.0.0.1` only; nginx is the only public surface.
- nginx config is a **new** file included via `sites-enabled`; no existing conf is edited.
- PM2 app name is unique; middleware is started, not the existing PM2 apps.
- Migrations run only against the Quality Postgres on its own port.

## 4. Ports

I cannot read your new server, so the runbook starts with a discovery step:

```bash
sudo ss -tulpn | sort -t: -k2 -n
docker ps --format '{{.Names}}\t{{.Ports}}'
```

Proposed allocation (deliberately away from 8000/8010/8443/9443/5433/5434/6543/6433 seen on the old box). Confirm against the discovery output before applying.

| Service | Quality | Production |
| --- | --- | --- |
| Frontend (nginx public) | 8081 | 8091 |
| Supabase API / Kong | 8001 | 8011 |
| Supabase Studio | 8082 | 8092 |
| PostgreSQL (loopback) | 54322 | 54422 |
| Kong internal (loopback) | 54321 | 54421 |
| Middleware (nginx public) | 3004 | 3014 |
| Middleware Node (loopback) | 3005 | 3015 |
| App Node SSR (loopback) | 3000 | 3010 |

## 5. Frontend build and placement

`npm run build` produces `dist/` (static frontend at root, Node SSR server at `dist/server/index.mjs`). The script copies static assets to `Quality/frontend/dist/` and runs the SSR server from the same release folder under systemd. Build env:

```
VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PROJECT_ID=enfa-quality
VITE_SUPABASE_PUBLISHABLE_KEY=<quality anon key>
```

with server-side `SUPABASE_URL=http://127.0.0.1:8001`, publishable + service-role keys read only by the Node process. `VITE_*` values are baked at build time — changing them requires a rebuild, which the document states explicitly.

## 6. The document (`deployment/README.md`)

Ordered, copy-pasteable sections:

1. Port discovery and confirmation
2. Create the folder tree under `/apps/webapplications/NFA_Approval/`
3. Generate secrets (`openssl` commands) and the ANON / SERVICE_ROLE JWTs
4. Start the Quality Supabase stack and verify health
5. Apply migrations, create the first user in Studio, seed the admin role
6. Build the frontend and publish `dist/`
7. Install and start the middleware under PM2 (`pm2 start`, `pm2 save`, `pm2 startup`)
8. Install the nginx config and reload (`nginx -t` first)
9. Smoke tests for each port
10. Rollback / restart cheatsheet, and how to clone Quality into Production
11. Cleanup: list of obsolete paths from the previous `/opt/enfa/...` attempt, flagged for **manual review only** — no delete commands run automatically

## 7. Notes

- No application source changes; everything lands under `deployment/`.
- Only placeholder secrets are committed.
- Plain HTTP over LAN IP; the document notes how to add TLS later.
