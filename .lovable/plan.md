# Restore the Quality-server application roles and sidebar

## Confirmed current state

The latest password login succeeds and the authenticated REST request returns `HTTP 200`. The earlier gateway 401 and `role "" does not exist` failures are therefore no longer active for this newly minted session.

The response body is `[]` because the request checks only `user_role_assignment` for the hard-coded UUID `38722bbc-c804-40bf-aead-059366c0063f`. It does not prove the logged-in token belongs to that UUID, and it does not check the built-in roles stored in `user_roles`.

The application intentionally loads both role sources:

- `user_roles.role` for built-in roles such as `admin` and `initiator`
- `user_role_assignment.role_key` for custom roles

## 1. Resolve and repair the exact login account

Run one transaction against the Quality database. Resolve the UUID from the email rather than reusing a UUID from another account or environment, keep the JWT database role as `authenticated`, and assign the application administrator role in `user_roles`:

```sql
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower('sunilkumar@sharviinfotech.com');

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login account not found';
  END IF;

  UPDATE auth.users
  SET aud = 'authenticated', role = 'authenticated', updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

SELECT u.id, u.email, u.aud, u.role AS jwt_database_role,
       array_remove(array_agg(DISTINCT ur.role::text), NULL) AS built_in_roles,
       array_remove(array_agg(DISTINCT ura.role_key), NULL) AS custom_roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.user_role_assignment ura ON ura.user_id = u.id
WHERE lower(u.email) = lower('sunilkumar@sharviinfotech.com')
GROUP BY u.id, u.email, u.aud, u.role;
```

An empty `custom_roles` array is valid when `built_in_roles` contains `admin`. Never put `admin` into `auth.users.role`; that field must remain `authenticated`.

## 2. Revoke the exposed credentials and mint a clean session

- Change the password pasted into chat, sign out, and clear site data for `10.200.1.7:8081`.
- Sign in again with the replacement password so Auth issues a fresh token.
- Confirm the token response shows the same UUID returned by the SQL query, with `aud: "authenticated"` and `role: "authenticated"`.
- Query `user_roles` using that UUID; it must return `admin`. `user_role_assignment` may legitimately remain empty.
- Query `role_permission?role_key=eq.admin`; verify the expected sidebar screens are allowed.

Do not paste the replacement password, access token, or refresh token into chat.

## 3. Correct the overly broad temporary RLS changes

The temporary expressions `user_id = auth.uid() OR auth.uid() IS NOT NULL` and `id = auth.uid() OR auth.uid() IS NOT NULL` allow every signed-in user to read every row. Replace them with the intended own-row/admin policies, and remove anonymous profile access because `profiles` contains email and contact data. Keep only the specific grants required by those policies.

Do not change RLS again to solve an empty role query; application-role assignment and RLS are separate concerns.

## 4. Prevent future empty JWT claims

The application user-creation flow should continue using the supported Auth admin API and separately writing business roles. Any manual SQL that creates `auth.users` rows on the Quality server must set:

Any manual SQL used to create users on the Quality server must set both fields below:

```sql
aud = 'authenticated'
role = 'authenticated'
```

Update the Quality-server manual creation script that produced the malformed account so future users receive these JWT claims. Continue assigning business roles only through `public.user_roles` or `public.user_role_assignment`.

## Success criteria

- The login response UUID matches the database account UUID.
- A fresh token contains `aud=authenticated` and `role=authenticated`.
- `user_roles` returns `admin`; an empty custom-role response does not block access.
- `role_permission` returns the admin screen permissions and the sidebar appears.
- Profiles and role assignments are no longer broadly readable by every authenticated or anonymous user.