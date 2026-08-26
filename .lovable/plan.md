# Restore Quality-server login and migrate local users

## Confirmed diagnosis

1. **The app server is not running.** `curl 127.0.0.1:3000/auth` is refused and PM2 contains only middleware processes. This causes the `/_serverFn/*` 502.
2. **The Quality API keys now match.** The frontend publishable key is the same as `ANON_KEY` in the backend environment, so no further key replacement is needed.
3. **The 401 is likely an old browser session.** The browser can retain a token issued by the cloud environment after the frontend is changed to Quality. Clear site data for `10.200.1.7:8081` after rebuilding/restarting.
4. **The Master Admin account is complete.** Screenshots verify its auth account, active profile, and `admin` role in both role tables.

## 1. Correct the app environment

Use a separate app environment file, not the backend Docker `.env`:

```env
SUPABASE_PROJECT_ID=self-hosted-quality
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>

VITE_SUPABASE_PROJECT_ID=self-hosted-quality
VITE_SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
VITE_SUPABASE_URL=http://10.200.1.7:8081

HOST=127.0.0.1
PORT=3000
NODE_ENV=production
```

Use `127.0.0.1:8001` for server-side calls and `10.200.1.7:8081` only for browser-side calls. Do not use `NODE_ENV=quality`; Node expects `production` for the production server.

## 2. Build and start the missing app process

From the deployed application source directory (the directory containing `package.json`):

```bash
npm ci
npm run build
ls -l .output/server/server.js
pm2 start .output/server/server.js --name NFA-Portal-App --time
pm2 save
pm2 ls
curl -i http://127.0.0.1:3000/auth
```

The environment file must be loaded before `pm2 start`; alternatively define it in a PM2 ecosystem file. The expected final PM2 list includes both:

- `NFA-Portal-App` on port 3000
- `NFA-Middleware` on port 3005

If `.output/server/server.js` does not exist, stop and send the output of `ls -la` plus `cat package.json`; do not guess another entry path.

## 3. Clear the stale browser session

After the app starts and the frontend is rebuilt:

1. Open Chrome DevTools on `http://10.200.1.7:8081`.
2. Application → Storage → **Clear site data**.
3. Close and reopen the login page.
4. First test with `masteradmin@sharviinfotech.com` and its password.
5. Then test with User ID `MASTERADMIN`.

This removes the old cloud-issued access token that the Quality gateway rejects.

## 4. Create the local users in Quality

Auth passwords cannot be recovered or recreated from the public user-management tables. For each user, first use **Authentication → Users → Add user**, set a temporary password, and enable auto-confirm. Create these known local accounts:

| Email | User ID | Name | Role |
| --- | --- | --- | --- |
| `kvvkkunchala@gmail.com` | `kvvk` | kvvk kunchala | initiator |
| `pradeep.p@sharviinfotech.com` | `pradeep` | pradeep ammisetty | initiator |
| `prasad.kvvk@sharviinfotech.com` | `prasad` | kvvk kunchala | admin |
| `demo@nfa.local` | `demo` | Demo User | admin |

After those four auth accounts exist, run this complete SQL block once to create/update their profiles and role assignments:

```sql
do $user_migration$
declare
  r record;
  v_id uuid;
begin
  for r in
    select * from (values
      ('kvvkkunchala@gmail.com',           'kvvk',    'kvvk',    'kunchala',  '8519954889', 'initiator'),
      ('pradeep.p@sharviinfotech.com',     'pradeep', 'pradeep', 'ammisetty', '7013584342', 'initiator'),
      ('prasad.kvvk@sharviinfotech.com',   'prasad',  'kvvk',    'kunchala',  '8519954889', 'admin'),
      ('demo@nfa.local',                   'demo',    'Demo',    'User',      null,         'admin')
    ) as x(email, username, first_name, last_name, contact, role_key)
  loop
    select id into v_id
      from auth.users
     where lower(email) = lower(r.email)
     limit 1;

    if v_id is null then
      raise exception 'Create auth user % first', r.email;
    end if;

    insert into public.profiles (
      id, email, full_name, username, first_name, last_name,
      contact, status, is_active
    ) values (
      v_id, lower(r.email), r.first_name || ' ' || r.last_name,
      r.username, r.first_name, r.last_name, r.contact, 'ACTIVE', true
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      contact = excluded.contact,
      status = 'ACTIVE',
      is_active = true;

    delete from public.user_roles where user_id = v_id;
    insert into public.user_roles (user_id, role)
    values (v_id, r.role_key::public.app_role);

    delete from public.user_role_assignment where user_id = v_id;
    insert into public.user_role_assignment (user_id, role_key)
    values (v_id, r.role_key);
  end loop;
end
$user_migration$;
```

Do not run only highlighted lines; include the final `$user_migration$;` delimiter.

## 5. Verify migrated users

```sql
select
  p.username,
  p.email,
  p.status,
  p.is_active,
  ur.role,
  ura.role_key
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
left join public.user_role_assignment ura on ura.user_id = p.id
where lower(p.email) in (
  'kvvkkunchala@gmail.com',
  'pradeep.p@sharviinfotech.com',
  'prasad.kvvk@sharviinfotech.com',
  'demo@nfa.local',
  'masteradmin@sharviinfotech.com'
)
order by p.email;
```

Then log in with each user's email and temporary password. User ID login will work only after `NFA-Portal-App` is online, because User ID resolution uses `/_serverFn/`.

## Security follow-up

The database password, JWT secret and both API keys were pasted into chat. After login is restored, rotate them together and rebuild/restart every dependent service. Do not paste the replacement values into chat.