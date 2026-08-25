# Create an admin login user on the Quality server

The previous query was only partially executed: it ended at `is_syst` and therefore never reached the closing `end $$;`. The SQL editor then appended unrelated text, producing the unterminated dollar-quote error.

## Screenshot result

The latest screenshot confirms the corrected SQL completed successfully: **“Success. No rows returned”** is the normal result for a `DO` block. The two red notifications are separate self-hosted Studio issues:

- `SNIPPETS_MANAGEMENT_FOLDER env var is not set` only disables saved SQL snippets. It does not affect the query or application login.
- `API error happened while trying to communicate with the server` is a Studio dashboard request failure. Since the SQL result says Success, it did not roll back this query.

Run the verification query in step 3 next. If it returns the expected Admin row, database setup is complete. The remaining login `405 Not Allowed` is caused by the missing application server/proxy route, not by these Studio notifications.

Use this safer two-step method. It avoids direct manipulation of auth internals and contains no dollar-quoted block.

## 1. Create the login account

In the Quality backend console, open **Authentication → Users → Add user** and create:

- Email: `masteradmin@sharviinfotech.com`
- Password: choose a new strong password
- Auto confirm user: enabled

This creates the valid login record, including the required auth identity. Do not insert directly into the internal auth tables.

## 2. Assign the application profile and Admin role

Open **SQL Editor**, paste the complete query below, and run it as one query:

```sql
-- Stop with no changes if the Authentication user does not exist.
do $admin_setup$
declare
  v_id uuid;
begin
  select id
    into v_id
    from auth.users
   where lower(email) = lower('masteradmin@sharviinfotech.com')
   limit 1;

  if v_id is null then
    raise exception 'Create masteradmin@sharviinfotech.com in Authentication > Users first';
  end if;

  insert into public.profiles (
    id, email, full_name, username, first_name, last_name,
    contact, status, is_active
  ) values (
    v_id,
    'masteradmin@sharviinfotech.com',
    'Master Admin',
    'MASTERADMIN',
    'Master',
    'Admin',
    '9999999999',
    'ACTIVE',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact = excluded.contact,
    status = excluded.status,
    is_active = excluded.is_active;

  -- Remove the default Initiator role added by the new-user trigger.
  delete from public.user_roles where user_id = v_id;
  insert into public.user_roles (user_id, role)
  values (v_id, 'admin');

  insert into public.app_role_def (key, name, description, is_system)
  values ('admin', 'Admin', 'Full application administration', true)
  on conflict (key) do update set name = excluded.name;

  delete from public.user_role_assignment where user_id = v_id;
  insert into public.user_role_assignment (user_id, role_key)
  values (v_id, 'admin');
end
$admin_setup$;
```

Do not run only a highlighted portion. The final two lines must be included exactly:

```sql
end
$admin_setup$;
```

## 3. Verify the result

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
where lower(p.email) = lower('masteradmin@sharviinfotech.com');
```

Expected values: `MASTERADMIN`, `ACTIVE`, `true`, `admin`, `admin`.

## Login and server requirement

- Email login works through the auth service after the user is created and confirmed.
- User ID login (`MASTERADMIN`) additionally requires the application server to run on port 3000 and Nginx to proxy `/_serverFn/` to it.
- The database/API secrets pasted in chat should be treated as exposed. Rotate the database password, JWT secret and generated API keys before production use, then update all dependent services together.