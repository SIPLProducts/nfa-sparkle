# eNFA Approval — Quality deployment on 10.200.1.7 (Ubuntu)

Step-by-step runbook. Every command is copy-pasteable. Nothing here modifies,
stops, or deletes the two applications already running on the server: the
Quality stack uses its own folders, its own Docker project name, its own
container/volume/network names, its own PM2 app name, its own nginx file and
its own ports.

Target layout on the server:

```text
/apps/webapplications/NFA_Approval/
├── nginx/
│   └── enfa-quality.conf
├── Quality/
│   ├── src/                     git checkout used only to build (optional to keep)
│   ├── frontend/
│   │   ├── .env                 build + runtime env
│   │   ├── dist/                published static frontend
│   │   └── server/              published Node SSR bundle (index.mjs)
│   ├── backend/
│   │   ├── docker-compose.yml
│   │   ├── .env
│   │   ├── volumes/{api,db}
│   │   └── migrations/          copy of supabase/migrations (optional)
│   ├── middleware/
│   │   ├── server.js  package.json  systems.json  .env
│   │   └── ecosystem.config.cjs
│   └── scripts/
│       ├── run-migrations.sh  seed-admin.sql  deploy-quality.sh
└── Production/                  same shape, different ports (section 11)
```

Files in this repo map 1:1 onto that tree:

| Repo | Server |
| --- | --- |
| `deployment/nginx/enfa-quality.conf` | `/apps/webapplications/NFA_Approval/nginx/enfa-quality.conf` |
| `deployment/Quality/backend/*` | `.../Quality/backend/` |
| `deployment/Quality/frontend/.env.example` | `.../Quality/frontend/.env` |
| `deployment/Quality/middleware/*` | `.../Quality/middleware/` |
| `deployment/Quality/scripts/*` | `.../Quality/scripts/` |
| repo `middleware/server.js`, `package.json` | `.../Quality/middleware/` |
| repo `supabase/migrations/*.sql` | `.../Quality/backend/migrations/` |

---

## 0. Prerequisites and port check

```bash
node -v          # 20 or 22
docker --version && docker compose version
pm2 -v || sudo npm i -g pm2
psql --version || sudo apt install -y postgresql-client
nginx -v
```

Run the discovery commands in [`PORTS.md`](./PORTS.md) and confirm that
**8081, 8001, 8082, 3004, 3000, 3005, 54321, 54322, 54323** are all free.
If any is taken, pick a replacement and change it in the three files listed there.

---

## 1. Create the folder tree

```bash
sudo mkdir -p /apps/webapplications/NFA_Approval/nginx
sudo mkdir -p /apps/webapplications/NFA_Approval/Quality/{frontend,backend,middleware,scripts}
sudo chown -R "$USER":"$USER" /apps/webapplications/NFA_Approval
cd /apps/webapplications/NFA_Approval/Quality
```

Get the application source (used only for building and for the SQL migrations):

```bash
git clone <your-repo-url> /apps/webapplications/NFA_Approval/Quality/src
cd /apps/webapplications/NFA_Approval/Quality/src
```

Copy the deployment kit into place:

```bash
SRC=/apps/webapplications/NFA_Approval/Quality/src
Q=/apps/webapplications/NFA_Approval/Quality

cp -r  $SRC/deployment/Quality/backend/*      $Q/backend/
cp     $SRC/deployment/Quality/frontend/.env.example  $Q/frontend/
cp     $SRC/deployment/Quality/middleware/*    $Q/middleware/
cp     $SRC/deployment/Quality/scripts/*       $Q/scripts/
cp     $SRC/middleware/server.js $SRC/middleware/package.json $Q/middleware/
mkdir -p $Q/backend/migrations && cp $SRC/supabase/migrations/*.sql $Q/backend/migrations/
cp     $SRC/deployment/nginx/enfa-quality.conf /apps/webapplications/NFA_Approval/nginx/
chmod +x $Q/scripts/*.sh
```

---

## 2. Generate the Quality secrets

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET       (40+ chars required)
openssl rand -hex 32   # SECRET_KEY_BASE
openssl rand -hex 16   # VAULT_ENC_KEY
openssl rand -hex 16   # LOGFLARE_PUBLIC_ACCESS_TOKEN
openssl rand -hex 16   # LOGFLARE_PRIVATE_ACCESS_TOKEN
openssl rand -hex 32   # middleware PROXY_SECRET
```

`ANON_KEY` and `SERVICE_ROLE_KEY` are HS256 JWTs signed with `JWT_SECRET`.
Generate them with stdlib Python only (no pip install):

```bash
JWT_SECRET='<paste JWT_SECRET>' python3 - <<'PY'
import base64, hashlib, hmac, json, os, time
s = os.environ["JWT_SECRET"].encode()
b = lambda o: base64.urlsafe_b64encode(json.dumps(o, separators=(',',':')).encode()).rstrip(b'=')
now = int(time.time())
for role in ("anon", "service_role"):
    h = b({"alg":"HS256","typ":"JWT"})
    p = b({"role":role,"iss":"supabase","ref":"enfa-quality","iat":now,"exp":now+10*365*24*3600})
    sig = base64.urlsafe_b64encode(hmac.new(s, h+b'.'+p, hashlib.sha256).digest()).rstrip(b'=')
    print(role.upper(), (h+b'.'+p+b'.'+sig).decode(), "\n")
PY
```

Fill in the backend env:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
cp .env.example .env && chmod 600 .env
nano .env      # secrets, keys; URLs already point at 10.200.1.7
```

---

## 3. Start the Quality Supabase stack

Project name `nfa-quality`, network `nfa-quality-net`, containers/volumes
`nfa-quality-*` — no collision with the existing stacks.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality up -d
docker compose -p nfa-quality ps          # wait until all are healthy
```

Verify without touching anything else:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <ANON_KEY>" http://127.0.0.1:54321/rest/v1/
docker ps --format '{{.Names}}' | grep nfa-quality
```

Optional log/analytics profile: `docker compose -p nfa-quality --profile analytics up -d`.

---

## 4. Apply the database schema

```bash
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/run-migrations.sh
# dry run first if you prefer:
# DRY_RUN=1 PGPASSWORD='...' ./scripts/run-migrations.sh
```

The script is idempotent — applied files are tracked in
`public.schema_migrations_applied`, re-runs only apply new files.

Create the first login in Studio (`http://10.200.1.7:8082`, dashboard
credentials from `backend/.env`) with **Auto Confirm** enabled, then grant admin:

```bash
PGPASSWORD='<POSTGRES_PASSWORD>' psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v admin_email="'admin@ramky.com'" -f scripts/seed-admin.sql
```

---

## 5. Build and publish the frontend

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend
cp .env.example .env && chmod 600 .env
nano .env     # ANON_KEY, SERVICE_ROLE_KEY
```

```bash
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD='<POSTGRES_PASSWORD>' SKIP_MIGRATIONS=1 SKIP_RESTART=1 ./scripts/deploy-quality.sh
ls frontend/dist/index.html frontend/server/index.mjs
```

`VITE_*` values are inlined at build time — after changing any of them you must
rebuild, a restart is not enough.

Run the SSR server as a systemd unit:

```bash
sudo tee /etc/systemd/system/enfa-quality-app.service >/dev/null <<'EOF'
[Unit]
Description=eNFA Quality portal (TanStack Start / Node)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/apps/webapplications/NFA_Approval/Quality/frontend
EnvironmentFile=/apps/webapplications/NFA_Approval/Quality/frontend/.env
ExecStart=/usr/bin/node /apps/webapplications/NFA_Approval/Quality/frontend/server/index.mjs
Restart=always
RestartSec=5
SyslogIdentifier=enfa-quality-app

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now enfa-quality-app
systemctl status enfa-quality-app --no-pager
```

---

## 6. Middleware (PM2)

```bash
cd /apps/webapplications/NFA_Approval/Quality/middleware
cp .env.example .env && chmod 600 .env && nano .env         # PROXY_SECRET
cp systems.example.json systems.json && nano systems.json   # SAP host/client/user
mkdir -p logs
npm install --omit=dev

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup      # run the printed command once, as root
curl -s http://127.0.0.1:3005/health
```

Only this app is managed; `pm2 restart enfa-quality-middleware` never touches
the other PM2 processes. Enter the same `PROXY_SECRET` in the portal under
**Admin → SAP API Settings → Middleware Configuration**, with base URL
`http://10.200.1.7:3004`.

---

## 7. nginx

```bash
sudo ln -sf /apps/webapplications/NFA_Approval/nginx/enfa-quality.conf \
            /etc/nginx/sites-enabled/enfa-quality.conf
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must pass before reloading. This adds one new file to
`sites-enabled`; no existing configuration is edited.

---

## 8. Smoke tests

```bash
curl -s -o /dev/null -w 'app     %{http_code}\n' http://10.200.1.7:8081/
curl -s -o /dev/null -w 'kong    %{http_code}\n' -H "apikey: <ANON_KEY>" http://10.200.1.7:8001/rest/v1/
curl -s -o /dev/null -w 'studio  %{http_code}\n' http://10.200.1.7:8082/
curl -s              http://10.200.1.7:3004/health
```

Then in a browser: `http://10.200.1.7:8081` → sign in → Reports → Execute, and
confirm the SAP call succeeds through the middleware.

---

## 9. Day-to-day operations

```bash
# redeploy after a code change
cd /apps/webapplications/NFA_Approval/Quality/src && git pull --ff-only
cd /apps/webapplications/NFA_Approval/Quality
PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/deploy-quality.sh

# services
sudo systemctl restart enfa-quality-app
pm2 restart enfa-quality-middleware
docker compose -p nfa-quality -f backend/docker-compose.yml restart

# logs
journalctl -u enfa-quality-app -f
pm2 logs enfa-quality-middleware
docker compose -p nfa-quality -f backend/docker-compose.yml logs -f auth
```

Rollback: keep the previous `frontend/dist` and `frontend/server` folders
(`cp -a frontend/dist frontend/dist.bak`) before a deploy and swap them back,
then `sudo systemctl restart enfa-quality-app`.

---

## 10. Isolation checklist (existing apps)

- Docker project `nfa-quality`; containers `nfa-quality-*`; volumes
  `nfa-quality-*`; network `nfa-quality-net`.
- All containers publish on `127.0.0.1` only.
- nginx: one new file, unique upstream names (`enfa_quality_*`) and unique
  `map` variable, so nothing clashes with existing configs.
- PM2 app name `enfa-quality-middleware`; systemd unit `enfa-quality-app`.
- Never run `docker compose down` without `-p nfa-quality`, and never run
  `docker system prune` on this server.

---

## 11. Cloning Quality into Production

```bash
cp -r /apps/webapplications/NFA_Approval/Quality \
      /apps/webapplications/NFA_Approval/Production
```

Then, in the Production copy:

1. Regenerate **all** secrets and the ANON / SERVICE_ROLE JWTs (never reuse Quality's).
2. `backend/.env`: `POSTGRES_PORT_HOST=54422`, `KONG_HTTP_PORT=54421`,
   `KONG_HTTPS_PORT=54424`, `STUDIO_PORT=54423`, URLs on ports 8091 / 8011.
3. `docker-compose.yml`: replace every `nfa-quality` with `nfa-production`
   (`name:`, `container_name`, network, volumes) and start with
   `docker compose -p nfa-production up -d`.
4. `frontend/.env`: `PORT=3010`, `SUPABASE_URL=http://127.0.0.1:8011`,
   `VITE_SUPABASE_URL=http://10.200.1.7:8091`, `*_PROJECT_ID=enfa-production`.
5. `middleware/.env`: `PORT=3015`; PM2 name `enfa-production-middleware`.
6. Copy the nginx file to `nginx/enfa-production.conf`, replace the four listen
   ports (8091/8011/8092/3014), the upstream ports (3010/54421/54423/3015),
   the `enfa_quality_*` names with `enfa_production_*`, the `map` variable name,
   the log file names and the `root` path.
7. systemd unit `enfa-production-app` pointing at the Production folder.

Quality and Production then share nothing: separate builds, envs, compose
projects, containers, databases, middleware and nginx files.

---

## 12. Cleanup — review before deleting anything

If an earlier attempt created these, they are now obsolete. **Inspect them
first; do not delete blindly**, and never remove anything belonging to the two
existing applications.

```bash
ls -la /opt/enfa 2>/dev/null                       # old app/middleware/supabase root
ls -la /etc/nginx/sites-enabled/ | grep -i nfa     # old nfa-quality.conf symlink
systemctl list-units --type=service | grep -i enfa # old enfa-app / enfa-middleware units
docker ps -a --format '{{.Names}}' | grep -i enfa
docker volume ls | grep -i enfa
```

Remove only after confirming each item is the old eNFA attempt:

```bash
sudo systemctl disable --now enfa-app enfa-middleware
sudo rm -f /etc/systemd/system/enfa-app.service /etc/systemd/system/enfa-middleware.service
sudo rm -f /etc/nginx/sites-enabled/nfa-quality.conf
sudo nginx -t && sudo systemctl reload nginx
# and, only when the data is confirmed disposable:
# sudo rm -rf /opt/enfa
```

## 13. TLS (later)

Plain HTTP over the LAN means API keys and logins travel unencrypted. When a
certificate is available, add `listen 443 ssl;` plus `ssl_certificate` /
`ssl_certificate_key` to the 8081 server block, update `SITE_URL`,
`API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` and `VITE_SUPABASE_URL` to `https://`,
and rebuild the frontend.
