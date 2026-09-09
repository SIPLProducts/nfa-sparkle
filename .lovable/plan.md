# Fix the dashboard error, the dashboard login prompt, and the 401 on sign-in

You build `dist` locally in VS Code and copy it to
`/apps/webapplications/NFA_Approval/Quality/frontend/dist`. There is no source
checkout on the server, so nothing below copies scripts from `src` and nothing
builds on the server. Everything is plain commands you paste on the server.

## The three problems

1. **Dashboard shows `password authentication failed for user "supabase_admin"`**
   The role passwords inside the existing Quality database volume are older than
   the value in `backend/.env`. They must be reset to the current value and the
   dashboard/meta containers recreated.

2. **`http://10.200.1.7:8082/` never asks for a username and password**
   The dashboard credentials in `backend/.env` are enforced by the API gateway on
   port 8001 only. Port 8082 proxies straight to the dashboard container. A
   password prompt has to be added on 8082 in the nginx file itself.

3. **`401 Unauthorized` on `/rest/v1/role_permission` after sign-in**
   The gateway rejects the key the browser sent. Since you say the configured
   keys are correct, the likely cause is that the running gateway container or
   the copied `dist` is carrying an older key. The commands below prove which one
   before anything is changed.

## Repo change (documentation only)

`deployment/README.md` gets one ordered "Quality recovery" section containing
exactly the commands below, so this is not reassembled from chat each time.
The nginx file already contains the 8082 password block. No application source
code changes, and no scripts need to be copied to the server.

## Commands you run on the server

### Step A - prove which copy of the key is stale (safe, read-only)

```text
cd /apps/webapplications/NFA_Approval/Quality/backend
ANON=$(grep -E '^ *ANON_KEY *=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ')

# fingerprint of the configured key
printf '%s' "$ANON" | sha256sum | cut -c1-12

# fingerprint of the key the running gateway holds
docker exec nfa-quality-kong printenv ANON_KEY | tr -d '\n' | sha256sum | cut -c1-12

# fingerprint(s) of the key inside the deployed browser build
grep -rhoE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' \
  ../frontend/dist/assets | sort -u | while read -r k; do
  printf '%s' "$k" | sha256sum | cut -c1-12; done

# does the configured key actually pass the gateway?
curl -s -o /dev/null -w '%{http_code}\n' \
  "http://127.0.0.1:8001/rest/v1/role_permission?select=role_key&limit=1" \
  -H "apikey: $ANON"
```

Any fingerprint that differs from the first one is the stale copy: gateway
mismatch is fixed in Step B, a `dist` mismatch means one rebuild in local VS Code
with the correct `VITE_SUPABASE_PUBLISHABLE_KEY` and a fresh copy of `dist`.

### Step B - repair the database roles and recreate the Quality containers

```text
cd /apps/webapplications/NFA_Approval/Quality/backend
PW=$(grep -E '^ *POSTGRES_PASSWORD *=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ')

docker exec -i -e RP="$PW" nfa-quality-db sh -eu -c \
 'psql -U postgres -d postgres -v ON_ERROR_STOP=1 --set=rp="$RP" -q' <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, :'rp')
FROM pg_roles WHERE rolname IN ('authenticator','pgbouncer','postgres',
 'supabase_admin','supabase_auth_admin','supabase_functions_admin',
 'supabase_read_only_user','supabase_storage_admin') \gexec
SQL

docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest realtime storage meta kong studio
docker ps --format '{{.Names}}\t{{.Status}}' | grep nfa-quality
```

Only Quality containers are touched; your `supabase-dev` and `supabase-prod`
stacks are untouched.

### Step C - turn on the dashboard login prompt (one time)

```text
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-quality-admin
sudo chmod 640 /etc/nginx/enfa-quality-studio.htpasswd
sudo chown root:www-data /etc/nginx/enfa-quality-studio.htpasswd
sudo nginx -t && sudo systemctl reload nginx
```

If your live nginx file lacks the `auth_basic` lines, add them to the `listen
8082` block from the copy in the project's `deployment/nginx/enfa-quality.conf`.

### Step D - give the app process its keys

```text
Q=/apps/webapplications/NFA_Approval/Quality
grep -E '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=' \
  $Q/frontend/.env | cut -d= -f1     # must list all three, no placeholders

pm2 delete enfa-quality-app 2>/dev/null
cd $Q/frontend && set -a && . ./.env && set +a && \
  pm2 start dist/server/index.mjs --name enfa-quality-app --update-env && pm2 save

pm2 logs enfa-quality-app --lines 20   # the Missing SUPABASE_SERVICE_ROLE_KEY line must be gone
```

`pm2 restart` alone reuses the old environment, which is why the key kept
appearing missing.

## Safety boundary

Only Quality containers, the Quality nginx block, the Quality app process, and
Quality documentation are affected. No data is deleted, no volume is recreated,
no build runs on the server, and no other application, container, port, or
volume is touched.
