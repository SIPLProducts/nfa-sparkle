# Fix quality-server login and role loading

## Confirmed diagnosis

This is **not primarily a missing-role problem**.

### 1. Login is blocked by nginx serving only static files

The login code calls `resolveLoginId` through a TanStack server function before password authentication. That creates a POST to `/_serverFn/...`.

Your nginx sends that POST to the static SPA fallback, which returns the visible **405 Not Allowed**. The repository's intended deployment instead runs the application server on `127.0.0.1:3000` and proxies all port-8081 app traffic to it.

### 2. The `role_permission` 401 happens before role assignment is checked

`AuthProvider` currently requests `role_permission` immediately when `/auth` opens, before the user has signed in. The quality database allows that table only to authenticated users, so the anonymous request is rejected.

A user without an assigned role would normally authenticate successfully and then receive an empty role result. It would not explain nginx's 405 response.

### 3. The `.env` does not match the repository's quality deployment design

The project deployment files define:

```text
8081 = TanStack app through nginx
8001 = backend API
3000 = private TanStack Node server
3004 = SAP middleware public port
3005 = private SAP middleware process
```

Therefore the browser and server backend URLs should use port **8001**, while users open the app on **8081**.

## Implementation plan

1. **Use the repository's server deployment architecture**
   - Run the built TanStack server on `127.0.0.1:3000` using `deploy/systemd/enfa-app.service` or an equivalent PM2 process.
   - Replace the static-only 8081 server block with the app proxy pattern already present in `deploy/nginx/enfa-qa.conf`.
   - Proxy all `location /` traffic on 8081 to port 3000. This handles pages, assets, `/_serverFn/*`, and app-owned `/api/public/*` routes correctly.
   - Keep backend API on its separate 8001 nginx server and SAP middleware on 3004; do not send all `/api/*` traffic to SAP middleware from the app vhost.

2. **Correct the application environment**

Use:

```text
HOST=127.0.0.1
PORT=3000
SUPABASE_URL=http://10.200.1.7:8001
VITE_SUPABASE_URL=http://10.200.1.7:8001
```

Keep `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` identical to the self-hosted quality stack's current `ANON_KEY`. Do not reuse a key from another environment. The quality `ANON_KEY` and `SERVICE_ROLE_KEY` must both have been generated from that quality stack's `JWT_SECRET`.

3. **Rebuild after correcting `VITE_*` values**

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a
. /opt/enfa/app.env
set +a
npm ci
npm run build
```

Then restart the app process and reload nginx.

4. **Adjust frontend role-permission loading**
   - Do not query `role_permission` anonymously when the login page mounts.
   - Load permissions only after a valid session is available.
   - Reload permissions whenever the signed-in identity changes so the first anonymous 401 cannot leave permissions empty for the rest of the session.
   - Preserve the current role model: `user_roles` plus `user_role_assignment`.

5. **Verify the user's application role separately**
   - After login works, check that this auth user's UUID has a row in either `public.user_roles` or `public.user_role_assignment`.
   - If no row exists, assign the intended application role through User Management or an approved database operation. The Authentication Users screen only confirms the auth account exists; it does not assign an app role.

## Server checks

Run these on Ubuntu before retrying:

```bash
curl -i http://127.0.0.1:3000/auth
curl -i http://10.200.1.7:8001/auth/v1/health
sudo nginx -t
sudo systemctl reload nginx
```

After a hard refresh, verify in DevTools:

```text
POST http://10.200.1.7:8081/_serverFn/... -> 200, not 405
POST http://10.200.1.7:8001/auth/v1/token?... -> 200 for valid credentials
GET  http://10.200.1.7:8001/rest/v1/role_permission?... -> 200 after sign-in
```

If `/_serverFn` still returns 405, the Node app is not running/proxied. If `/auth/v1/token` returns `Invalid API key`, the frontend publishable key does not match the quality stack's `ANON_KEY`. If role queries return `200` but empty, then assign the user an application role.
