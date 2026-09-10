# Repair the Quality database dashboard first, then fix Login

This repair uses the existing server folders only. It does not expect a
`Quality/src` folder, does not build on Ubuntu, and does not touch DEV or PROD.

## Confirmed root causes

1. The dashboard error is not caused by missing tables. The dashboard’s schema
   service is trying to connect as `supabase_admin`, and the database rejects
   that password. The Quality compose file confirms that Meta reads
   `PG_META_DB_PASSWORD` from `POSTGRES_PASSWORD`. The role password and the
   running container value must be synchronized before Studio can show users,
   schemas, or tables.
2. `src/lib/auth-context.tsx` currently requests `role_permission` immediately
   when the login page mounts, before a session exists. The table is restricted
   to signed-in users, so this request is invalid and produces the screenshot’s
   `401`.
3. Permission data must still be checked directly after the database connection
   is repaired. The prepared import contains 28 permission rows, but the real
   Quality database count must decide whether migrations are needed.

## 1. Repair `supabase_admin` on the Ubuntu server

Run this exact block. It reads the real password from the existing `.env`, does
not print it, changes only Quality database roles, and preserves all data.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
set -a
. ./.env
set +a

docker exec -i -e ROLE_PASSWORD="$POSTGRES_PASSWORD" nfa-quality-db sh -eu -c '
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    --set=role_password="$ROLE_PASSWORD" -q
' <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, :'role_password')
FROM pg_roles
WHERE rolname IN (
  'authenticator', 'pgbouncer', 'postgres', 'supabase_admin',
  'supabase_auth_admin', 'supabase_functions_admin',
  'supabase_read_only_user', 'supabase_storage_admin'
);
\gexec
SQL

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" nfa-quality-db \
  psql -h 127.0.0.1 -U supabase_admin -d postgres -tAqc 'select 1'
```

The last command must print `1`. Stop and send its output if it does not.

## 2. Reload only the affected Quality services

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest storage meta studio

for i in $(seq 1 30); do
  STATE=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nfa-quality-meta)
  echo "meta: $STATE"
  [ "$STATE" = healthy ] && break
  sleep 2
done

docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
docker logs nfa-quality-meta --since 5m --tail 50
```

Success means `nfa-quality-meta` and `nfa-quality-studio` are healthy and the
recent Meta log no longer contains `password authentication failed`.
Realtime is not required for login or dashboard tables; diagnose its own log
separately without touching `supabase-dev` or `supabase-prod`.

## 3. Verify users, permissions, grants, and policies directly

```bash
docker exec -i nfa-quality-db psql -U postgres -d postgres <<'SQL'
select count(*) as users from auth.users;
select count(*) as profiles from public.profiles;
select count(*) as permission_rows from public.role_permission;
select role_key, count(*) from public.role_permission group by role_key order by 1;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='role_permission'
order by grantee, privilege_type;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='role_permission';
SQL
```

Expected imported data: 10 users, 10 profiles, and 28 permission rows. The table
must grant signed-in access and remain unavailable anonymously.

If the table is missing or the counts are zero, run the existing migrations:

```bash
cd /apps/webapplications/NFA_Approval/Quality
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh
```

Then repeat the verification query. No password should be pasted; the script
reads `backend/.env`.

## 4. Verify the browser bundle uses the running gateway key

This prints fingerprints only, never the key itself.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
ANON=$(grep -E '^ANON_KEY=' .env | tail -n1 | cut -d= -f2- | tr -d '"'\'' ')

printf 'backend.env  %s\n' "$(printf '%s' "$ANON" | sha256sum | cut -c1-12)"
printf 'kong runtime %s\n' "$(docker exec nfa-quality-kong printenv ANON_KEY | tr -d '\n' | sha256sum | cut -c1-12)"

grep -rhoE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' \
  ../frontend/dist/assets 2>/dev/null | sort -u | while read -r key; do
  printf 'dist bundle  %s\n' "$(printf '%s' "$key" | sha256sum | cut -c1-12)"
done
```

The backend and Kong fingerprints must match. One `dist bundle` fingerprint
must also match. Only if the copied `dist` does not match, rebuild once in local
VS Code with that existing Quality `ANON_KEY` as
`VITE_SUPABASE_PUBLISHABLE_KEY`, then replace `Quality/frontend/dist`.
Do not regenerate correct keys and do not build on Ubuntu.

## 5. Fix the application’s permission-loading order

Update `src/lib/auth-context.tsx` so:

- no `role_permission` request runs on `/auth` without a session;
- roles and permissions load together only after a signed-in user exists;
- both are refreshed when the signed-in user changes;
- both are cleared on sign-out;
- token refreshes for the same user do not reset open screens.

Build in local VS Code as usual and copy only the resulting `dist` to:

```text
/apps/webapplications/NFA_Approval/Quality/frontend/dist
```

Restart the already-copied release with its runtime environment:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend
set -a
. ./.env
set +a
pm2 delete enfa-quality-app 2>/dev/null || true
pm2 start dist/server/index.mjs --name enfa-quality-app --update-env
pm2 save
pm2 logs enfa-quality-app --lines 30 --nostream
```

The log must not report a missing `SUPABASE_SERVICE_ROLE_KEY`.

## 6. Final verification

1. Reload `http://10.200.1.7:8082`; users and tables must load.
2. Open `http://10.200.1.7:8081/auth`; there must be no anonymous
   `role_permission` request.
3. Sign in; the auth request must succeed, followed by signed-in
   `role_permission`, `user_roles`, and `user_role_assignment` requests.
4. The signed-in `role_permission` request must return `200` and the correct
   navigation permissions.

## Safety boundary

No volume is removed, no data is deleted, no secret is printed, no Ubuntu build
is run, and no DEV/PROD container or configuration is changed.