# eNFA - Ubuntu QA deployment guide

Single Ubuntu server, plain HTTP, reached by IP address. Everything runs behind
nginx; the Node processes and the Supabase containers bind to localhost only.

## Port map

| Public port | Service | Backend |
| ----------- | ------- | ------- |
| 8081 | eNFA portal | Node `127.0.0.1:3000` |
| 8001 | Supabase API (Kong) | docker `127.0.0.1:54321` |
| 8082 | Supabase Studio | docker `127.0.0.1:54323` |
| 3004 | SAP middleware | Node `127.0.0.1:3005` |

Directory layout used throughout: `/opt/enfa/app`, `/opt/enfa/middleware`,
`/opt/enfa/supabase`, env file `/opt/enfa/app.env`.

---

## 0. Quality-server file kit (quick reference)

| File in this repo | Install to | Purpose |
| ----------------- | ---------- | ------- |
| `deploy/nginx/nfa-quality.conf` | `/etc/nginx/sites-available/nfa-quality.conf` (symlink into `sites-enabled`) | self-contained nginx config with upstreams for all four vhosts: 8081, 8001, 8082, 3004 |
| `deploy/supabase/docker-compose-quality.yml` | `/opt/enfa/supabase/docker-compose-quality.yml` | **standalone** Supabase stack, no upstream repo needed |
| `deploy/supabase/volumes/api/kong.yml` | `/opt/enfa/supabase/volumes/api/kong.yml` | Kong declarative routes |
| `deploy/supabase/volumes/logs/vector.yml` | `/opt/enfa/supabase/volumes/logs/vector.yml` | Log shipper (optional analytics profile) |
| `deploy/supabase/.env.quality.example` | `/opt/enfa/supabase/.env` | Supabase stack secrets, ports, public URLs |
| `deploy/env/app.env.quality.example` | `/opt/enfa/app.env` | app build + runtime env |
| `deploy/env/middleware.env.quality.example` | `/opt/enfa/middleware/.env` | middleware port, proxy secret, SAP timeout |
| `deploy/scripts/run-migrations.sh` | run from `/opt/enfa/app` | applies `supabase/migrations/*.sql`, idempotent |
| `deploy/scripts/seed-admin.sql` | run with `psql` | grants the `admin` role to the first login |
| `deploy/scripts/deploy-quality.sh` | run from `/opt/enfa/app` | pull → build → migrate → restart → health check |
| `deploy/systemd/enfa-app.service` / `enfa-middleware.service` | `/etc/systemd/system/` | services |

Order to run:

```bash
# 1. Supabase stack (standalone, isolated from DEV/PROD)
cd /opt/enfa/supabase
cp /opt/enfa/app/deploy/supabase/docker-compose-quality.yml .
cp -r /opt/enfa/app/deploy/supabase/volumes ./
cp /opt/enfa/app/deploy/supabase/.env.quality.example .env && nano .env
docker compose -p nfa-quality -f docker-compose-quality.yml up -d

# 2. Schema
cd /opt/enfa/app
cp deploy/env/app.env.quality.example /opt/enfa/app.env && nano /opt/enfa/app.env
chmod +x deploy/scripts/*.sh
PGPASSWORD='<POSTGRES_PASSWORD>' ./deploy/scripts/run-migrations.sh

# 3. Admin login: create the user in Studio (Auto Confirm), then
PGPASSWORD='<POSTGRES_PASSWORD>' psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v admin_email="'admin@ramky.com'" -f deploy/scripts/seed-admin.sql

# 4. App + middleware
cp deploy/env/middleware.env.quality.example /opt/enfa/middleware/.env && nano /opt/enfa/middleware/.env
./deploy/scripts/deploy-quality.sh

# 5. nginx
sudo cp deploy/nginx/nfa-quality.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/nfa-quality.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

The sections below explain each step in detail. `deploy/nginx/enfa-qa.conf` is the
earlier equivalent of `nfa-quality.conf` — install only one of the two.

---

## 1. Prerequisites


## 1. Prerequisites

Ubuntu 22.04 or 24.04, root/sudo access.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx postgresql-client ca-certificates gnupg ufw

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x

# Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out / back in

# service account
sudo useradd -r -m -d /opt/enfa -s /bin/bash enfa || true
sudo mkdir -p /opt/enfa/{app,middleware,supabase,backups}
sudo chown -R enfa:enfa /opt/enfa
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8081/tcp    # app
sudo ufw allow 8001/tcp    # supabase api
sudo ufw allow 8082/tcp    # studio (also IP-restricted in nginx)
sudo ufw allow 3004/tcp    # sap middleware
sudo ufw enable
sudo ufw status
```

---

## 2. Self-hosted Supabase (ports 8001 / 8082)

Follow `deploy/supabase/README.md` end to end. When you are done you must have:

- `docker compose ps` all healthy
- the `ANON_KEY` and `SERVICE_ROLE_KEY` values noted down
- all files from `supabase/migrations/` applied
- one admin login created

---

## 3. Deploy the app (port 8081)

```bash
sudo -iu enfa
cd /opt/enfa/app
git clone <your repo url> .        # or rsync the project folder here

# runtime env
cp deploy/env/app.env.example /opt/enfa/app.env
nano /opt/enfa/app.env             # fill SERVER_IP + the two Supabase keys
chmod 600 /opt/enfa/app.env
```

**Build.** `VITE_*` variables are inlined at build time, so they must exist in
the shell during the build:

```bash
cd /opt/enfa/app
set -a; . /opt/enfa/app.env; set +a
npm ci
npm run build          # output: dist/ (static frontend) + .output/server/server.js (Node)

# publish the static frontend nginx serves on 8081
sudo mkdir -p /opt/enfa/frontend
sudo rsync -a --delete dist/ /opt/enfa/frontend/
```

**Service:**

```bash
exit                                  # back to your sudo user
sudo cp /opt/enfa/app/deploy/systemd/enfa-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enfa-app
sudo systemctl status enfa-app
curl -I http://127.0.0.1:3000/
```

---

## 4. SAP middleware (port 3004)

```bash
sudo -iu enfa
cp -r /opt/enfa/app/middleware/* /opt/enfa/middleware/
cd /opt/enfa/middleware
npm install --omit=dev

cp .env.example .env
nano .env          # PORT=3005, PROXY_SECRET=<openssl rand -hex 32>, TIMEOUT_MS=180000
cp systems.example.json systems.json
nano systems.json  # SAP host/IP, port, client, user, password; mark one "default": true
chmod 600 .env systems.json
exit

sudo cp /opt/enfa/app/deploy/systemd/enfa-middleware.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enfa-middleware
curl http://127.0.0.1:3005/health     # must show "version":"1.1.0","getBodySupported":true
```

The server must be able to reach SAP over the LAN:

```bash
curl -I http://10.200.1.2:8000/ --max-time 5
```

---

## 5. nginx

```bash
sudo cp /opt/enfa/app/deploy/nginx/enfa-qa.conf /etc/nginx/sites-available/enfa-qa.conf
sudo ln -sf /etc/nginx/sites-available/enfa-qa.conf /etc/nginx/sites-enabled/enfa-qa.conf
sudo rm -f /etc/nginx/sites-enabled/default        # optional
sudo nano /etc/nginx/sites-available/enfa-qa.conf  # set the allow/deny range on the 8082 block
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Configure the app after first login

1. Open `http://<SERVER_IP>:8081` and sign in with the admin user created in Studio.
2. **Admin → SAP API Settings → Middleware Configuration**
   - Connection Mode: `Via Proxy Server`
   - Middleware URL: `http://<SERVER_IP>:3004`
   - Middleware Port: `3004`
   - Proxy Secret: the same value as `PROXY_SECRET` in `/opt/enfa/middleware/.env`
   - press **Test middleware** → must return healthy
3. **SAP Systems** tab - add the QA SAP system (host, port, client, user, password) and mark it Active.
4. **APIs** tab - confirm every endpoint (report, create, display edit, approvals,
   attachments, upload, print/preview, F4 lookups) is registered and points at the
   correct path. These rows come from the migrations; verify nothing is missing.

---

## 7. Verification checklist

- [ ] `curl -I http://<SERVER_IP>:8081/` → 200
- [ ] `curl http://<SERVER_IP>:3004/health` → JSON with `"ok": true`
- [ ] `curl http://<SERVER_IP>:8001/rest/v1/ -H "apikey: <ANON_KEY>"` → JSON
- [ ] `http://<SERVER_IP>:8082` opens Studio (from an allowed IP)
- [ ] Login works, dashboard loads
- [ ] eNFA Report returns SAP rows
- [ ] Attached Docs opens and a file previews
- [ ] Create eNFA saves and returns an ENFA number

Logs:

```bash
journalctl -u enfa-app -f
journalctl -u enfa-middleware -f
sudo tail -f /var/log/nginx/enfa-app.error.log
cd /opt/enfa/supabase && docker compose logs -f --tail=100
```

---

## 8. Updating

```bash
sudo -iu enfa
cd /opt/enfa/app
git pull
set -a; . /opt/enfa/app.env; set +a
npm ci
npm run build
sudo rsync -a --delete dist/ /opt/enfa/frontend/
# new migrations, if any (defaults to quality port 54322)
PGPASSWORD='<pw>' ./deploy/scripts/run-migrations.sh
exit
sudo systemctl restart enfa-app
```

Middleware update: copy the new `middleware/server.js`, then
`sudo systemctl restart enfa-middleware` and re-check `/health`.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 502 on 8081 | Node app not running | `systemctl status enfa-app`, check `journalctl -u enfa-app` |
| Login page loads but auth fails | `VITE_SUPABASE_*` baked with wrong URL/key | fix `/opt/enfa/app.env` and **rebuild** |
| `Invalid proxy secret` | secret mismatch | make API Settings match `/opt/enfa/middleware/.env` |
| SAP calls time out at ~85s | slow SAP record | expected for large attachment sets; results are cached after the first success. nginx is set to 200s so it is SAP, not the proxy |
| Middleware reachable but SAP unreachable | LAN routing / firewall | test `curl http://<sap-ip>:8000/` from the server |
| Studio 403 | your IP is outside the allow list | edit the `allow` lines in the 8082 block, `nginx -t && systemctl reload nginx` |
| Upload fails with 413 | body larger than 25 MB | raise `client_max_body_size` in the app + middleware blocks |

---

## 10. Security notes for this QA setup

- Traffic is plain HTTP by IP, so Supabase keys and SAP payloads travel
  unencrypted on the LAN. Acceptable inside a trusted network only.
- To add TLS later: point a hostname at the server, add `listen 443 ssl;`
  vhosts and run `sudo certbot --nginx`, then change `SITE_URL`,
  `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` and the `VITE_SUPABASE_URL` build
  variable to the `https://` addresses and rebuild.
- `SERVICE_ROLE_KEY` must stay in `/opt/enfa/app.env` (mode 600). Never place
  it in a `VITE_` variable.
- Keep `DISABLE_SIGNUP=true`; users are created by the admin.
- Rotate the SAP service-user password if it has ever been shared in a document.
