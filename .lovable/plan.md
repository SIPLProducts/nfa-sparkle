# Create a user + roles directly in the Quality database

The role_permission rows are correct (admin has `user_management`, `report`, `sap_api`, `nfa_my`, `nfa_new` = true). So the remaining need is: create a login user in the self-hosted database, with profile fields and roles, using SQL only.

Run everything in the SQL Editor (or `psql -h 127.0.0.1 -p 5435 -U postgres -d postgres`).

## 1. One-shot script: create user + profile + roles

Edit only the six values in the first block.

```sql
-- pgcrypto is needed to hash the password the same way GoTrue does
create extension if not exists pgcrypto;

do $$
declare
  v_email    text := 'john.doe@sharviinfotech.com';  -- login email
  v_username text := 'JOHN_RSSPL';                   -- User ID used on the login page
  v_password text := 'Test@1234';                    -- 8-10 chars
  v_first    text := 'John';
  v_last     text := 'Doe';
  v_contact  text := '9876543210';                   -- 10 digits
  v_roles    text[] := array['admin','initiator'];   -- any of initiator/approver/admin/viewer
  v_uid      uuid;
  r          text;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      lower(v_email), crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_first || ' ' || v_last)
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(v_email)),
            'email', now(), now(), now());
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until = null,
           updated_at = now()
     where id = v_uid;
  end if;

  -- profile row the app reads (User ID login + User Management list)
  insert into public.profiles (id, email, full_name, first_name, last_name, username, contact, status, is_active)
  values (v_uid, lower(v_email), v_first || ' ' || v_last, v_first, v_last, v_username, v_contact, 'ACTIVE', true)
  on conflict (id) do update
     set email = excluded.email,
         full_name = excluded.full_name,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         username = excluded.username,
         contact = excluded.contact,
         status = 'ACTIVE',
         is_active = true;

  -- roles
  delete from public.user_roles where user_id = v_uid;
  foreach r in array v_roles loop
    insert into public.user_roles (user_id, role) values (v_uid, r::public.app_role)
    on conflict do nothing;
  end loop;

  raise notice 'user ready: % (%)', v_email, v_uid;
end $$;
```

## 2. Verify

```sql
select p.email, p.username, p.status,
       array_agg(ur.role::text order by ur.role) as roles
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
group by p.email, p.username, p.status
order by p.email;
```

## 3. Custom roles (only if you use non-system roles)

System roles are `initiator`, `approver`, `admin`, `viewer` and live in `user_roles`.
Custom roles live in `app_role_def` + `user_role_assignment`:

```sql
-- define the role
insert into public.app_role_def (key, name, description, is_system)
values ('finance_reviewer', 'Finance Reviewer', 'Reviews budget impact', false)
on conflict (key) do nothing;

-- screen access for it (screen keys: dashboard, nfa_new, nfa_my, approvals, report, sap_api, user_management)
insert into public.role_permission (role_key, screen, allowed)
values ('finance_reviewer','dashboard',true),
       ('finance_reviewer','report',true)
on conflict (role_key, screen) do update set allowed = excluded.allowed;

-- assign it to a user
insert into public.user_role_assignment (user_id, role_key)
select id, 'finance_reviewer' from public.profiles where lower(email) = 'john.doe@sharviinfotech.com'
on conflict do nothing;
```

## Notes

- After changing roles, the affected user must sign out and back in — roles and screen permissions are loaded once at sign-in.
- Login works with either the User ID (`JOHN_RSSPL`) or the email, plus the password.
- No application code changes are part of this plan; it is database work only.
