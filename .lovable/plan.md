# Server login via User Management: tables + nginx review

## Where users are stored

Login is handled by the app's own auth/database stack, not SAP. Creating a user in **User Management** writes to four places:

```text
auth.users                  -> the login account (email + password)
public.profiles             -> User ID, first/last name, contact, dept, status
public.user_roles           -> built-in roles: initiator, approver, admin, viewer
public.user_role_assignment -> custom roles created in the Roles tab
```

Screen access is then resolved from:

```text
public.role_permission      -> role_key + screen + allowed
```

Login flow:

1. User types **User ID or Email**.
2. Server function `resolveLoginId` maps the User ID to the account email through `profiles`.
3. Password sign-in runs against `auth.users`.
4. Roles are read from `user_roles` + `user_role_assignment`.

So a user must be created through **User Management** (not only the Authentication → Users screen), because only User Management fills `profiles` and role tables. A user created directly in Authentication has no User ID and no role, so User-ID login and screen access will fail.

## Is the nginx config correct?

Mostly yes. It now proxies the pieces that were missing before.

Correct parts:

```text
/_serverFn/    -> 127.0.0.1:3000   (login + app server functions)
/api/public/   -> 127.0.0.1:3000   (create-user JSON endpoint)
/auth/v1       -> 127.0.0.1:8001   (sign-in)
/rest/v1       -> 127.0.0.1:8001   (roles, permissions, app tables)
/storage/v1    -> 127.0.0.1:8001
/realtime/v1   -> 127.0.0.1:8001
/api/          -> 127.0.0.1:3005   (SAP middleware)
```

`/api/public/` correctly wins over `/api/` because nginx prefers the longer prefix match.

Three things to fix:

1. **Body size for uploads through the app server.** The app server block allows 25m, but the backend API block is separate; keep 25m here and make sure the 8001 listener also allows large bodies.

2. **Timeouts for SAP-backed calls.** Attachment fetches can run 95-170s. Add to the `/_serverFn/` and `/api/public/` blocks:

```nginx
proxy_connect_timeout  30s;
proxy_send_timeout    200s;
proxy_read_timeout    200s;
proxy_buffering off;
```

3. **Websocket header on realtime.** Add `proxy_set_header Connection "upgrade";` consistently, and avoid sending the upgrade header on plain REST blocks.

Everything else in your file is fine.

## Required environment values

The browser must reach the backend API on port 8001:

```text
SUPABASE_URL=http://10.200.1.7:8001
VITE_SUPABASE_URL=http://10.200.1.7:8001
```

The publishable/anon key must be the one generated for this quality stack. After changing any `VITE_*` value, rebuild:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a; . /opt/enfa/app.env; set +a
npm ci
npm run build
```

Then copy the build output to the frontend dist path, restart the Node app on port 3000, and reload nginx.

## App change in this plan

Adjust `src/lib/auth-context.tsx` so `role_permission` is fetched **after** a session exists rather than on page load. Today it runs while the login page is open with no session, producing the `401 Unauthorized` you saw, and can leave permissions empty afterwards. Permissions will reload whenever the signed-in user changes.

No other application logic changes.

## How to create a working server user

1. Sign in on the server as an admin user.
2. Open **User Management → Users → Create user**.
3. Fill User ID, first/last name, email, contact, status, password, and at least one role.
4. Submit; the request goes to `/api/public/create-user` and creates the auth account, profile, and role rows together.
5. Sign in with that User ID or email.

If no admin exists yet on the server, create the first admin by assigning the `admin` role to an existing auth user directly in the database, then use User Management for all later users.

## Verification

```bash
curl -i http://127.0.0.1:3000/auth
curl -i http://10.200.1.7:8001/auth/v1/health
sudo nginx -t && sudo systemctl reload nginx
```

In DevTools after a hard refresh:

```text
POST /_serverFn/...            -> 200
POST /auth/v1/token?...        -> 200
GET  /rest/v1/user_roles?...   -> 200 with a role row
GET  /rest/v1/role_permission  -> 200 (only after sign-in)
```
