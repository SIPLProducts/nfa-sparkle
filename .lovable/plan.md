# Restore User Management and create users on Quality

## Confirmed diagnosis

The latest response identifies the immediate failure:

```text
Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

The login request succeeds (`token?grant_type=password` = 200), but the following role reads return 401. The Admin permission rows also exist and include `user_management = true`. Therefore this is **not a missing role-permission migration**.

The Node/PM2 application was started without a usable server-side Quality environment. Create User needs `SUPABASE_SERVICE_ROLE_KEY` on the Node server, while authenticated server calls need `SUPABASE_URL` and the publishable key.

### The keys currently in use belong to the wrong backend

The values in the current environment file decode to a payload containing:

```text
"ref": "nhrwogdnwtkmbygwlrkv"
```

That reference identifies the hosted cloud project, not the Quality stack. Those tokens were signed with the cloud signing secret, so the Quality gateway cannot validate them and rejects the requests. This explains why sign-in returns 200 while `user_roles`, `user_role_assignment`, `nfa`, and `nfa_approver` all return 401 immediately afterwards.

Renaming `SUPABASE_PROJECT_ID` to `self-hosted-quality` does not change this, because the project reference is embedded inside the signed token itself.

The correct values are the `ANON_KEY` and `SERVICE_ROLE_KEY` generated for the Quality stack, stored in the Quality backend environment file next to its `JWT_SECRET`:

```bash
grep -cE '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' \
  /opt/Ramky_Applications/NFA-Approval/Quality/backend/.env
```

The result must be `3`. Copy those two key values, not the cloud values.

### The server URL should be the local gateway

`SUPABASE_URL` is used by the Node process on the same machine, so it should point directly at the Quality API gateway (`http://127.0.0.1:8001`) instead of looping back through the public web port. Only `VITE_SUPABASE_URL` uses the browser-visible address.

The second error is an independent runtime mismatch:

```text
Node.js 20 detected without native WebSocket support
```

The installed backend client version expects native WebSocket support when a client is created. Node 20 does not provide it. The fix is to run the generated server bundle on Node 22; no realtime code change is required.

## 1. Create the Quality runtime environment file

On the Ubuntu server, create the file expected by the deployment layout:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality
cp frontend/deploy/env/app.env.quality.example frontend.env
chmod 600 frontend.env
nano frontend.env
```

Set these values using the keys from the Quality backend `.env`:

```env
HOST=127.0.0.1
PORT=3000
NODE_ENV=production

SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from the Quality backend .env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from the Quality backend .env>
SUPABASE_PROJECT_ID=enfa-quality

VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<same Quality ANON_KEY>
VITE_SUPABASE_PROJECT_ID=enfa-quality
```

Never put the service-role key in a `VITE_` variable.

Confirm the key now belongs to the Quality stack (prints only the reference field, never the secret):

```bash
set -a; . /opt/Ramky_Applications/NFA-Approval/Quality/frontend.env; set +a
cut -d. -f2 <<<"$SUPABASE_PUBLISHABLE_KEY" | base64 -d 2>/dev/null | grep -o '"ref":"[^"]*"'
```

It must **not** print `nhrwogdnwtkmbygwlrkv`.


## 2. Upgrade the application runtime to Node 22

Check the current executable first:

```bash
node --version
which node
```

If it reports Node 20, install/select Node 22 using the server's existing Node version manager or package-management standard. With `nvm`:

```bash
nvm install 22
nvm alias default 22
nvm use 22
node --version
```

Expected: `v22.x.x`. If PM2 was installed under Node 20, reinstall it under the active Node 22 environment so its daemon and startup command use the same executable:

```bash
npm install -g pm2
pm2 kill
```

Do not add a browser WebSocket polyfill. This is the Node application server, not a frontend browser issue.

## 3. Rebuild and restart PM2 with the environment

The `VITE_*` values are embedded during build; the server values are read at runtime. Load the same file for both:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
set -a
. ../frontend.env
set +a

npm run build
test -f dist/server/index.mjs && echo 'build ready'

pm2 delete NFA-Portal-App 2>/dev/null || true
pm2 start /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist/server/index.mjs \
  --name NFA-Portal-App \
  --cwd /opt/Ramky_Applications/NFA-Approval/Quality/frontend \
  --update-env
pm2 save
```

Verify variable **presence only** without printing secret values:

```bash
pm2 env "$(pm2 pid NFA-Portal-App)" | grep -E '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY):' | sed 's/:.*/: SET/'
pm2 logs NFA-Portal-App --lines 50 --nostream
```

All three names must show `SET`, and the missing-environment error must be absent.

Also confirm PM2 is now using Node 22:

```bash
pm2 describe NFA-Portal-App | grep -E 'node.js version|interpreter'
```

## 4. Clear the stale browser session

Because the screenshot shows login 200 followed by four 401 responses:

1. Sign out.
2. Chrome DevTools → Application → Storage → Clear site data for `10.200.1.7:8081`.
3. Hard refresh and sign in again.
4. Confirm `user_roles`, `user_role_assignment`, `nfa`, and `nfa_approver` no longer return 401.

## 5. Create users through User Management

Once the server environment is restored, use **Admin → User Management → Create User**. This is safer than inserting directly into authentication system tables and automatically creates:

- the authentication account and password,
- the `profiles` row,
- system roles in `user_roles`,
- custom roles in `user_role_assignment`.

## 6. SQL query to assign roles to an existing user

If the user already exists in Authentication and `profiles`, assign system roles with this SQL. Change only the email and role list:

```sql
do $$
declare
  v_email text := 'user@example.com';
  v_roles public.app_role[] := array['initiator','approver']::public.app_role[];
  v_uid uuid;
begin
  select id into v_uid
  from public.profiles
  where lower(email) = lower(v_email);

  if v_uid is null then
    raise exception 'No profile exists for %; create the user in User Management first', v_email;
  end if;

  delete from public.user_roles where user_id = v_uid;

  insert into public.user_roles (user_id, role)
  select v_uid, unnest(v_roles)
  on conflict (user_id, role) do nothing;
end $$;
```

Valid system roles are `initiator`, `approver`, `admin`, and `viewer`.

Verify:

```sql
select p.email, p.username, p.status,
       array_agg(ur.role::text order by ur.role) as roles
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where lower(p.email) = lower('user@example.com')
group by p.email, p.username, p.status;
```

## Technical note

No schema migration is required for either error shown. The recovery is to use Node 22, supply the correct Quality environment, rebuild with the correct browser URL/key, restart PM2 using `--update-env`, and then refresh the browser session. This addresses the missing environment error, the Node 20 WebSocket error, the User Management server-function 500s, and the post-login role request failures as separate verified runtime/configuration issues.