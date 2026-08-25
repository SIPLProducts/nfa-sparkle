# Quality server: wire the new self-hosted Supabase keys

Your pasted block mixes two environments: the `SUPABASE_*` / `VITE_SUPABASE_*` lines still point at the Lovable-hosted project (`https://nhrwogdnwtkmbygwlrkv.supabase.co` and its old anon key), while `ANON_KEY` / `SERVICE_ROLE_KEY` are the new keys you just minted from your own `JWT_SECRET`. On the quality server the app must use only the self-hosted values, otherwise the browser will keep talking to the cloud project.

## What to change

### 1. Supabase stack env — `/opt/enfa/supabase/.env`
Keep the values you already generated:

```
POSTGRES_PASSWORD=95453b...        (as-is)
JWT_SECRET=9fa0091b...             (as-is)
ANON_KEY=<the new anon JWT>
SERVICE_ROLE_KEY=<the new service-role JWT>
SECRET_KEY_BASE=18f8d863...
VAULT_ENC_KEY=fd3c1999...
API_EXTERNAL_URL=http://<SERVER_IP>:8001
SUPABASE_PUBLIC_URL=http://<SERVER_IP>:8001
SITE_URL=http://<SERVER_IP>:8081
```

`ANON_KEY` and `SERVICE_ROLE_KEY` must be signed with this exact `JWT_SECRET`, or every request returns "Invalid API key".

### 2. App env — `/opt/enfa/app.env`
Replace the cloud values entirely:

```
HOST=127.0.0.1
PORT=3000
NODE_ENV=production

SUPABASE_URL=http://<SERVER_IP>:8001
SUPABASE_PUBLISHABLE_KEY=<new ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<new SERVICE_ROLE_KEY>
SUPABASE_PROJECT_ID=self-hosted-quality

VITE_SUPABASE_URL=http://<SERVER_IP>:8001
VITE_SUPABASE_PUBLISHABLE_KEY=<new ANON_KEY>
VITE_SUPABASE_PROJECT_ID=self-hosted-quality
```

Notes:
- `<SERVER_IP>` must be an address the **browser** can reach, not `127.0.0.1`.
- Never put the service-role key in a `VITE_` variable.
- `VITE_*` values are baked in at build time, so the app must be rebuilt after any change here, not just restarted.

### 3. Middleware env — `/opt/enfa/middleware/.env`
```
PORT=3005
PROXY_SECRET=<openssl rand -hex 32>
ALLOW_IPS=
TIMEOUT_MS=180000
```
Then enter the same `PROXY_SECRET` in the app under Admin -> SAP API Settings -> Middleware Configuration.

### 4. Apply order
1. `docker compose --env-file .env -f docker-compose.yml -f deploy/supabase/docker-compose-quality.yml up -d`
2. `deploy/scripts/run-migrations.sh` against the local Postgres
3. `deploy/scripts/seed-admin.sql` to grant the admin role to your login
4. Build and restart the app: `set -a; . /opt/enfa/app.env; set +a; npm ci && npm run build`, then `systemctl restart enfa-app enfa-middleware`
5. `sudo nginx -t && sudo systemctl reload nginx`

## Repo change proposed
Update `deploy/env/app.env.quality.example` and `deploy/README.md` so the project id reads `self-hosted-quality` and add an explicit warning that no `nhrwogdnwtkmbygwlrkv` / `*.supabase.co` value may remain in the quality env. No application code changes.
