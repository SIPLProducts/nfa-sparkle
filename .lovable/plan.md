# Exact changes: frontend .env, nginx, backend

## 1. Frontend/app `.env` changes

Your current file is missing values the server side needs, and it is missing the app server port settings.

Keep as-is (these are correct, because nginx on 8081 proxies `/auth/v1` and `/rest/v1` to 8001):

```text
SUPABASE_PROJECT_ID="self-hosted-quality"
VITE_SUPABASE_PROJECT_ID="self-hosted-quality"
SUPABASE_URL="http://10.200.1.7:8081"
VITE_SUPABASE_URL="http://10.200.1.7:8081"
VITE_SUPABASE_PUBLISHABLE_KEY="<quality ANON_KEY>"
SUPABASE_PUBLISHABLE_KEY="<quality ANON_KEY>"
```

Add these missing lines:

```text
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
SUPABASE_SERVICE_ROLE_KEY="<quality SERVICE_ROLE_KEY>"
```

Why the service role key is required:

- `resolveLoginId` (User ID login) uses the privileged client to map User ID to email.
- `/api/public/create-user` uses it to create the auth account and write profile and role rows.

Without it, User-ID login fails and Create User fails.

Two checks on the keys themselves:

- `ANON_KEY` and `SERVICE_ROLE_KEY` must both be generated from the quality stack's own `JWT_SECRET`.
- The `ref` inside the token is irrelevant for self-hosted; the signature is what matters.

Never expose the service role key with a `VITE_` prefix.

## 2. nginx changes

Your latest config is structurally correct. Only add resilience settings.

In the `/_serverFn/` and `/api/public/` blocks add:

```nginx
proxy_connect_timeout  30s;
proxy_send_timeout    200s;
proxy_read_timeout    200s;
proxy_buffering off;
```

In the `/rest/v1` and `/storage/v1` blocks add:

```nginx
client_max_body_size 50m;
proxy_read_timeout 120s;
```

Leave ordering unchanged. `/api/public/` correctly takes priority over `/api/` because nginx prefers the longer prefix.

No other nginx changes are needed.

## 3. Backend/server-side changes

- Ensure the built app server actually runs on `127.0.0.1:3000` (PM2 or systemd). If nothing listens there, `/_serverFn/` returns 502 and login fails.
- Ensure the static build output is deployed to `/opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist`.
- Rebuild after any `VITE_*` change:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a; . ./.env; set +a
npm ci
npm run build
```

- Restart the app process, then `sudo nginx -t && sudo systemctl reload nginx`.

## 4. Application code change

Update `src/lib/auth-context.tsx` so `role_permission` is loaded only after a session exists, and reloaded when the signed-in user changes. Currently it is requested on the login page with no session, which produces the `401 Unauthorized` you saw and can leave permissions empty after sign-in.

No other application logic changes.

## 5. User creation on the server

Users must be created from **User Management → Create user**, which writes:

```text
auth.users                  login account
public.profiles             User ID, name, contact, dept, status
public.user_roles           built-in roles
public.user_role_assignment custom roles
```

A user added only through the Authentication → Users screen has no User ID and no role, so User-ID login and screen access will not work.

If the server has no admin yet, grant `admin` in `public.user_roles` for one existing auth user, then manage everyone else through User Management.

## 6. Verification

```bash
curl -i http://127.0.0.1:3000/auth
curl -i http://10.200.1.7:8081/auth/v1/health
sudo nginx -t && sudo systemctl reload nginx
```

In DevTools after hard refresh:

```text
POST /_serverFn/...           -> 200 (not 405/502)
POST /auth/v1/token?...       -> 200
GET  /rest/v1/user_roles?...  -> 200 with a role row
GET  /rest/v1/role_permission -> 200 only after sign-in
```
