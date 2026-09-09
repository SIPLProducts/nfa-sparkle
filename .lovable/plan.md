# Fix the Quality login 401, the missing permission data, and the dashboard error

Everything below is copy-paste. Run each block on the server in order and stop
if a block fails. Nothing is built on the server; only the already-copied
`frontend/dist` is used.

## What is actually wrong

1. `nfa-quality-meta`, `nfa-quality-studio` and `nfa-quality-realtime` cannot log
   in to the database, so the dashboard shows
   `password authentication failed for user "supabase_admin"` and you cannot see
   any tables or rows there.
2. Because of that you also cannot confirm whether the permission rows exist.
   The import file already contains 28 permission rows; Step 3 checks the real
   database directly instead of through the dashboard.
3. The login page asks for permission rows before you are signed in. That table
   is readable by signed-in users only, so it answers `401`. This is fixed in the
   application code and needs one local rebuild.

## Step 1 - repair the database logins

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
PW=$(grep -E '^[[:space:]]*POSTGRES_PASSWORD[[:space:]]*=' .env | tail -n1 | cut -d= -f2- | tr -d '"'\'' ')

docker exec -i -e RP="$PW" nfa-quality-db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, current_setting('rp.v'))
FROM pg_roles WHERE rolname IN ('authenticator','pgbouncer','postgres',
 'supabase_admin','supabase_auth_admin','supabase_functions_admin',
 'supabase_read_only_user','supabase_storage_admin') \gexec
SQL
```

If the block above complains about `rp.v`, use this equivalent instead:

```bash
docker exec -i -e RP="$PW" nfa-quality-db sh -eu -c \
 'psql -U postgres -d postgres -v ON_ERROR_STOP=1 --set=rp="$RP" -q' <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, :'rp')
FROM pg_roles WHERE rolname IN ('authenticator','pgbouncer','postgres',
 'supabase_admin','supabase_auth_admin','supabase_functions_admin',
 'supabase_read_only_user','supabase_storage_admin') \gexec
SQL
```

Then recreate only the Quality services and check them:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest realtime storage meta kong studio

sleep 30
docker ps --filter "name=nfa-quality" --format "table {{.Names}}\t{{.Status}}"
```

## Step 2 - if realtime still restarts

```bash
docker logs nfa-quality-realtime --tail 40
grep -E '^(SECRET_KEY_BASE|VAULT_ENC_KEY)=' \
  /apps/webapplications/NFA_Approval/Quality/backend/.env | cut -d= -f1
```

Realtime needs both names listed. Send me the log output and I will give the
exact follow-up command. Realtime is not required for login.

## Step 3 - check the permission data in the real database

```bash
docker exec -i nfa-quality-db psql -U postgres -d postgres -c "
select count(*) as permission_rows from public.role_permission;"

docker exec -i nfa-quality-db psql -U postgres -d postgres -c "
select role_key, count(*) from public.role_permission group by role_key order by 1;"

docker exec -i nfa-quality-db psql -U postgres -d postgres -c "
select grantee, privilege_type from information_schema.role_table_grants
where table_name='role_permission';"

docker exec -i nfa-quality-db psql -U postgres -d postgres -c "
select count(*) as users from auth.users;
select count(*) as profiles from public.profiles;
select count(*) as user_roles from public.user_roles;"
```

Expected: 28 permission rows, 10 users, 10 profiles, 11 role rows, and grants for
`authenticated` and `service_role`.

If the counts are 0 or the table is missing, load the data:

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh
```

Then re-run the count queries above.

## Step 4 - prove where the 401 comes from

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
ANON=$(grep -E '^[[:space:]]*ANON_KEY[[:space:]]*=' .env | tail -n1 | cut -d= -f2- | tr -d '"'\'' ')

printf 'env    %s\n' "$(printf '%s' "$ANON" | sha256sum | cut -c1-12)"
printf 'kong   %s\n' "$(docker exec nfa-quality-kong printenv ANON_KEY | tr -d '\n' | sha256sum | cut -c1-12)"
grep -rhoE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' \
  ../frontend/dist/assets 2>/dev/null | sort -u | while read -r k; do
  printf 'dist   %s\n' "$(printf '%s' "$k" | sha256sum | cut -c1-12)"; done

# anon key alone (401 here is expected - the table is for signed-in users)
curl -s -o /dev/null -w 'anon-only: %{http_code}\n' \
  "http://127.0.0.1:8001/rest/v1/role_permission?select=role_key&limit=1" -H "apikey: $ANON"

# now as a signed-in user - replace the email and password with a real login
TOKEN=$(curl -s "http://127.0.0.1:8001/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | grep -oE '"access_token":"[^"]+"' | cut -d'"' -f4)

curl -s -o /dev/null -w 'signed-in: %{http_code}\n' \
  "http://127.0.0.1:8001/rest/v1/role_permission?select=role_key,screen,allowed" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
```

Reading the result:

- `signed-in: 200` - the database and keys are fine; the only remaining problem
  is the login page asking too early, fixed in Step 6.
- `kong` fingerprint differs from `env` - recreate the gateway:
  `docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps kong`
- `dist` fingerprint differs from `env` - the copied build carries an old key;
  rebuild locally in VS Code with the correct `VITE_SUPABASE_PUBLISHABLE_KEY`
  and copy `dist` again.

## Step 5 - give the app process its keys

```bash
Q=/apps/webapplications/NFA_Approval/Quality
grep -E '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=' \
  $Q/frontend/.env | cut -d= -f1

pm2 delete enfa-quality-app 2>/dev/null
cd $Q/frontend && set -a && . ./.env && set +a && \
  pm2 start dist/server/index.mjs --name enfa-quality-app --update-env && pm2 save
pm2 logs enfa-quality-app --lines 20 --nostream
```

All three names must be listed and the "Missing SUPABASE_SERVICE_ROLE_KEY" line
must be gone.

## Step 6 - application change (I make this, you rebuild once)

I will change `src/lib/auth-context.tsx` so the permission list is requested only
after a session exists, refreshed when the signed-in user changes, and cleared on
sign-out. Nothing else changes, and the table stays closed to anonymous readers.

After that change: build in local VS Code, copy the new `dist` to
`/apps/webapplications/NFA_Approval/Quality/frontend/dist`, then re-run Step 5.

## Step 7 - dashboard password prompt

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-quality-admin
sudo chmod 640 /etc/nginx/enfa-quality-studio.htpasswd
sudo chown root:www-data /etc/nginx/enfa-quality-studio.htpasswd
sudo nginx -t && sudo systemctl reload nginx
```

## Safety boundary

Only Quality containers, the Quality database roles, the Quality app process and
the Quality nginx block are touched. No volume is removed, no data is deleted, no
key is printed, and `supabase-dev` and `supabase-prod` are left alone.
