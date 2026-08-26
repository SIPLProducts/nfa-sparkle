# Restore User Management and create users on Quality

## Confirmed diagnosis

The latest response identifies the immediate failure:

```text
Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

The login request succeeds (`token?grant_type=password` = 200), but the following role reads return 401. The Admin permission rows also exist and include `user_management = true`. Therefore this is **not a missing role-permission migration**.

The Node/PM2 application was started without a usable server-side Quality environment. Create User needs `SUPABASE_SERVICE_ROLE_KEY` on the Node server, while authenticated server calls need `SUPABASE_URL` and the publishable key.

### Verify token signing consistency before replacing keys

The values in the current environment file decode to a payload containing:

```text
"ref": "nhrwogdnwtkmbygwlrkv"
```

That reference came from the hosted project, but the `ref` claim by itself does not determine whether a JWT is valid. A self-hosted gateway can accept it if all Quality services use the same signing secret. The successful password-token request proves the gateway accepts the anon key for the Auth endpoint.

The important symptom is: Auth issues a session successfully, then REST rejects that new access token with 401. This most strongly indicates that the Auth and REST containers may not share the same JWT secret. Confirm this without printing any secrets:

```bash
AUTH_HASH=$(docker inspect nfa-quality-auth --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^GOTRUE_JWT_SECRET=//p' | sha256sum | cut -d' ' -f1)
REST_HASH=$(docker inspect nfa-quality-rest --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^PGRST_JWT_SECRET=//p' | sha256sum | cut -d' ' -f1)
printf 'Auth JWT hash: %s\nREST JWT hash: %s\n' "$AUTH_HASH" "$REST_HASH"
```

The two hashes must be identical. If they differ, recreate the Auth and REST services from the same Quality backend `.env`; merely restarting the existing containers will preserve their old environment:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
docker compose up -d --force-recreate auth rest kong
docker compose ps
```

Then clear the browser's old session and sign in again so Auth issues a fresh token.

The Quality backend environment must contain `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` generated as one matching set:

```bash
grep -cE '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' \
  /opt/Ramky_Applications/NFA-Approval/Quality/backend/.env
```

The result must be `3`. Use the matching Quality `ANON_KEY` and `SERVICE_ROLE_KEY` in `frontend.env`. Do not regenerate only one key; all three values must remain a matching set.

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

The decoded `ref` is informational only and is not the validation test. Validate the complete setup by requesting a new login session and confirming an authenticated `/rest/v1/user_roles` request no longer returns 401.

## 2. Install Node 22 alongside Node 20 and isolate it to this app

The server-wide `/usr/bin/node` can remain at Node 20. Do **not** change the default Node version, kill PM2, or reinstall PM2; doing so could restart or alter the other projects.

Install Node 22 alongside Node 20 with `nvm`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
NODE22="$(nvm which 22)"
"$NODE22" --version
```

Expected: `v22.x.x`. `/usr/bin/node` remains Node 20, while only `NFA-Portal-App` will receive the explicit Node 22 interpreter path.

Why this project differs: its current realtime client checks for native WebSocket support during server-client initialization. Node 20 does not provide that global API, while Node 22 does. Existing projects that do not initialize this dependency can continue working normally on Node 20.

Do not add a browser WebSocket polyfill. This is a Node application-server runtime requirement, not a frontend browser issue.

## 3. Rebuild and restart PM2 with the environment

The `VITE_*` values are embedded during build; the server values are read at runtime. Load the same file for both:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
NODE22="$(nvm which 22)"

cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
set -a
. ../frontend.env
set +a

"$(dirname "$NODE22")/npm" run build
test -f dist/server/index.mjs && echo 'build ready'

pm2 delete NFA-Portal-App 2>/dev/null || true
pm2 start /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist/server/index.mjs \
  --name NFA-Portal-App \
  --cwd /opt/Ramky_Applications/NFA-Approval/Quality/frontend \
  --interpreter "$NODE22" \
  --update-env
pm2 save
```

Verify only this process uses Node 22:

```bash
pm2 show NFA-Portal-App | grep -E 'interpreter|node.js version'
pm2 ls
```

The other PM2 processes are not deleted or restarted and retain their existing interpreters.

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

No schema migration is required for either error shown. The recovery is to use the Quality-signed keys, point the server at the local gateway, run on Node 22, rebuild so the browser bundle carries the correct URL/key, restart PM2 with `--update-env`, and clear the old browser session.

## Security follow-up

The service-role and anon keys pasted into chat must be treated as exposed. After login is working, rotate the Quality `JWT_SECRET` and regenerate its `ANON_KEY` and `SERVICE_ROLE_KEY`, restart the backend containers, update `frontend.env`, and rebuild. Do not paste the replacements into chat.
