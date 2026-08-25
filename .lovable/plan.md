# Create an admin login user directly in the Quality database

Run this in the self-hosted SQL editor (port 8001 → SQL Editor) on the Quality server. It creates a real auth account, fills the app profile, and grants the Admin role so the user can sign in with **User ID or Email**.

## What it does

- Creates the sign-in account (email + password, already confirmed — no email needed).
- Fills the app profile: User ID, first/last name, contact, active status.
- Grants the `admin` role in both role tables the app checks.

## The query

Edit the four values at the top, then run the whole block once.

```sql
-- pgcrypto is needed to hash the password
create extension if not exists pgcrypto;

do $$
declare
  v_email    text := 'masteradmin@sharviinfotech.com';  -- login email
  v_password text := 'Admin@12345';                     -- login password
  v_userid   text := 'MASTERADMIN';                     -- User ID used on the login screen
  v_first    text := 'Master';
  v_last     text := 'Admin';
  v_contact  text := '9999999999';
  v_id       uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      lower(v_email), crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_first || ' ' || v_last)
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.profiles (id, email, full_name, username, first_name, last_name, contact, status, is_active)
  values (v_id, lower(v_email), v_first || ' ' || v_last, v_userid, v_first, v_last, v_contact, 'ACTIVE', true)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        contact = excluded.contact,
        status = 'ACTIVE',
        is_active = true;

  insert into public.user_roles (user_id, role) values (v_id, 'admin') on conflict do nothing;

  insert into public.app_role_def (key, name, is_system)
  values ('admin', 'Admin', true) on conflict (key) do nothing;

  insert into public.user_role_assignment (user_id, role_key)
  values (v_id, 'admin') on conflict do nothing;
end $$;
```

Verify:

```sql
select p.username, p.email, p.status, ur.role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where lower(p.email) = lower('masteradmin@sharviinfotech.com');
```

## Tables involved

| Table | Purpose |
| --- | --- |
| `auth.users` | the actual login credentials |
| `public.profiles` | User ID (`username`), name, contact, status |
| `public.user_roles` | enum role (`admin`) |
| `public.user_role_assignment` + `app_role_def` | named role used by screen permissions |

## Note on login still failing

Password sign-in goes straight to the auth service, so this user will work for **Email + Password** immediately. **User ID** login also needs the app server (port 3000) reachable through Nginx at `/_serverFn/`, which is the separate deployment fix already outlined.
