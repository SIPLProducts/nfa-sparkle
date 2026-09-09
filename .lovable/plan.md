# Recover the Quality frontend and backend

The two failures are independent:

- **Frontend:** PM2 and nginx respond, but `/auth` is unstyled and the logo is broken. The HTML is loading while its generated CSS/JavaScript/assets are not. We will identify the exact missing URL before changing nginx, then deploy one clean matching release.
- **Backend:** database, Auth, Realtime, and Meta must be diagnosed separately. The previously confirmed `28P01` errors require synchronizing internal database-role passwords on the existing Quality database; a Docker image pull error requires its exact output and may be a separate registry/network issue.

No existing applications, non-Quality containers, shared nginx configuration, or ports will be changed.

## 1. Capture the frontend asset failure

Run on the server:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist

curl -sS http://127.0.0.1:3000/auth -o /tmp/enfa-auth.html
grep -oE '(src|href)="[^"]+"' /tmp/enfa-auth.html | head -30

curl -sS -I http://127.0.0.1:8081/assets/$(ls assets | head -1)
sudo tail -50 /var/log/nginx/nfa-quality-app.error.log
pm2 logs enfa-quality-app --lines 50 --nostream
```

The HTML output tells us the real CSS and JavaScript URLs. Test each generated `/assets/...` URL with `curl -I`. A `404`, wrong content type, or filename absent from `dist/assets` confirms either an incomplete copy or a server/static bundle from different builds.

## 2. Deploy one clean, matching frontend release

Build on Windows with the **Quality** browser values present before the build:

```powershell
npm install
npm run build
```

On the server, stop only the ENFA app, replace rather than merge the old release, and preserve a rollback copy:

```bash
pm2 stop enfa-quality-app
cd /apps/webapplications/NFA_Approval/Quality/frontend
mv dist dist.backup-$(date +%Y%m%d-%H%M%S)
mkdir dist
```

Copy the newly built `dist` contents into that empty `dist` folder. It must contain `assets`, `icons`, `server/index.mjs`, favicons, and the manifest from the **same build**.

For the current server bundle, also provide Nitro's expected public directory:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
mkdir -p public
cp -a assets icons favicon.ico favicon.png manifest.webmanifest public/
PORT=3000 HOST=127.0.0.1 pm2 restart enfa-quality-app --update-env
sudo nginx -t && sudo systemctl reload nginx
```

Verify the exact CSS/JS URLs from Step 1 return `200` and appropriate content types, then hard-refresh `/auth`. Do not proceed to login testing until the styled page loads.

## 3. Capture the backend state and Docker pull error

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
ls -la
docker compose -p nfa-quality config --services
docker compose -p nfa-quality ps -a
docker compose -p nfa-quality pull 2>&1 | tee /tmp/nfa-quality-pull.log
docker logs nfa-quality-auth --tail 80
docker logs nfa-quality-realtime --tail 80
docker logs nfa-quality-meta --tail 80
```

The exact `pull` output distinguishes DNS/proxy/TLS/rate-limit/image-tag failures. We will not change image tags or Docker networking without that evidence.

Also confirm required variables exist **without printing their values**:

```bash
for key in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SECRET_KEY_BASE VAULT_ENC_KEY; do
  grep -q "^${key}=." .env && echo "$key: set" || echo "$key: MISSING"
done
```

The repository root `.env` shown in the project belongs to Lovable Cloud and must **not** be copied to this self-hosted backend. The server backend needs its own `.env` based on `deployment/Quality/backend/.env.example`.

## 4. Repair the existing Quality database roles without wiping data

If logs still show `28P01`, load the server `.env` and synchronize only the built-in roles in `nfa-quality-db`:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
set -a; . ./.env; set +a

docker exec -i nfa-quality-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v role_password="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', rolname, :'role_password')
FROM pg_roles
WHERE rolname IN (
  'authenticator', 'pgbouncer', 'supabase_admin', 'supabase_auth_admin',
  'supabase_functions_admin', 'supabase_read_only_user', 'supabase_storage_admin'
)
\gexec
SQL
```

Verify both failing credentials across the Docker network:

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" nfa-quality-db \
  psql -h 127.0.0.1 -U supabase_auth_admin -d postgres -c 'select 1'
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" nfa-quality-db \
  psql -h 127.0.0.1 -U supabase_admin -d postgres -c 'select 1'
```

Both must return `1`. If the password contains URL-reserved characters, use a new hex-only password, update the server backend `.env`, and rerun the synchronization. Do not use `down -v` unless the Quality database is confirmed disposable.

## 5. Start and verify the backend in dependency order

```bash
docker compose -p nfa-quality up -d db
docker compose -p nfa-quality up -d auth realtime rest meta storage
docker compose -p nfa-quality up -d kong studio
docker compose -p nfa-quality ps

curl -i http://127.0.0.1:54321/auth/v1/health
curl -i -H "apikey: $ANON_KEY" http://127.0.0.1:54321/rest/v1/
curl -i http://127.0.0.1:8001/auth/v1/health
```

Only after these checks pass should login be tested from `http://10.200.1.7:8081/auth`.

## Repository changes after approval

1. Update `scripts/pack-dist.mjs` so every build automatically contains both root static assets and `dist/public`, eliminating the manual copy.
2. Add an idempotent `deployment/Quality/scripts/fix-db-roles.sh` for existing Quality volumes.
3. Update `deployment/README.md` with the clean-release workflow, diagnostic commands, direct role repair, and Docker-pull troubleshooting.
4. Validate shell syntax and deployment-file consistency; application behavior and UI remain unchanged.

## Success criteria

- `/auth` loads with the full corporate styling, JavaScript behavior, and logo.
- The generated CSS/JS asset requests return `200`, not HTML or `404`.
- Auth and Realtime can both authenticate to PostgreSQL.
- All Quality containers are healthy/running, and Kong health checks succeed.
- Login reaches the Quality backend without affecting any other server application.