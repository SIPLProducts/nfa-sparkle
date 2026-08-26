# Repair the empty JWT role and restore user-role loading

## Confirmed cause

The request now reaches the REST/database layer, so the earlier Kong API-key 401 is no longer the active failure.

The newly issued access token contains:

```text
aud: ""
role: ""
```

REST uses the JWT `role` claim as the PostgreSQL request role. It therefore attempts to use a role named `""` and returns:

```text
role "" does not exist
```

This JWT/database role is separate from the application's `admin`, `initiator`, `approver`, and custom roles stored in `user_roles` and `user_role_assignment`.

## 1. Repair this auth account

Run this in the Quality SQL editor, using the confirmed user UUID:

```sql
BEGIN;

UPDATE auth.users
SET aud = 'authenticated',
    role = 'authenticated',
    updated_at = now()
WHERE id = '0c99fe8b-0fcd-4d3e-9aae-176becabbf52';

-- Choose the required built-in application role here.
-- This example assigns Initiator.
INSERT INTO public.user_roles (user_id, role)
VALUES ('0c99fe8b-0fcd-4d3e-9aae-176becabbf52', 'initiator'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;

SELECT id, email, aud, role
FROM auth.users
WHERE id = '0c99fe8b-0fcd-4d3e-9aae-176becabbf52';

SELECT user_id, role
FROM public.user_roles
WHERE user_id = '0c99fe8b-0fcd-4d3e-9aae-176becabbf52';
```

For an administrator, replace `initiator` with `admin`. Do not put the application role into `auth.users.role`; that column must remain `authenticated`.

## 2. Mint a corrected session

- Sign out completely and clear the site data for `10.200.1.7:8081`.
- Sign in again so Auth issues a new token.
- Confirm the new decoded token has `aud: "authenticated"` and `role: "authenticated"`.
- Re-test `user_roles`, `user_role_assignment`, and `role_permission`; the `role "" does not exist` response must be gone.

The access and refresh tokens pasted into chat are exposed credentials. Revoke that session by signing out before testing the replacement session, and do not paste the new tokens.

## 3. Prevent future users from receiving empty claims

The current application user-creation code uses the supported admin Auth API and separately writes application roles. Keep that flow.

Any manual SQL used to create users on the Quality server must set both fields below:

```sql
aud = 'authenticated'
role = 'authenticated'
```

Update the server-side manual user-creation script/query that created this account so every future auth user gets those values. Continue assigning business roles only through `public.user_roles` or `public.user_role_assignment`.

## Success criteria

- A fresh login token contains `aud=authenticated` and `role=authenticated`.
- REST requests no longer return `role "" does not exist`.
- The selected application role is returned from the appropriate role-assignment table.
- Sidebar screens appear according to `role_permission` for that application role.