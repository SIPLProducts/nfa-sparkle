# Start the missing application server on port 3000

## Confirmed status

```text
127.0.0.1:3000/auth -> connection refused
10.200.1.7:8081/auth/v1/health -> 200 OK
nginx -t -> successful
```

Therefore:

- Backend authentication is running correctly.
- nginx is valid and can reach the auth backend.
- The **TanStack Node application server is not running**.
- `/_serverFn/*` login requests and `/api/public/create-user` cannot work until port 3000 is online.

This is the direct cause of the current User ID login/Create User failure. It is not caused by SAP or a missing role.

## 1. Complete the backend `.env`

In:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/.env
```

ensure these exist:

```text
HOST=127.0.0.1
PORT=3000
NODE_ENV=production

SUPABASE_URL=http://10.200.1.7:8081
SUPABASE_PUBLISHABLE_KEY=<quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<quality SERVICE_ROLE_KEY>
SUPABASE_PROJECT_ID=self-hosted-quality

VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<same quality ANON_KEY>
VITE_SUPABASE_PROJECT_ID=self-hosted-quality
```

Do not put the service role key in a `VITE_` variable.

Using 8081 here is valid with your current nginx because `/auth/v1`, `/rest/v1`, `/storage/v1`, and `/realtime/v1` are proxied from 8081 to the backend on 8001.

## 2. Build the server bundle

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a
. ./.env
set +a
npm ci
npm run build
ls -l .output/server/server.js dist/index.html
```

Both files must exist.

## 3. Start the app with systemd

Create `/etc/systemd/system/enfa-app.service` using the actual server path:

```ini
[Unit]
Description=eNFA Portal TanStack Server
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Ramky_Applications/NFA-Approval/Quality/backend
EnvironmentFile=/opt/Ramky_Applications/NFA-Approval/Quality/backend/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node .output/server/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now enfa-app
sudo systemctl status enfa-app --no-pager
sudo journalctl -u enfa-app -n 100 --no-pager
```

For production hardening, this can later run under a dedicated `enfa` user. Using `root` here matches the current deployment ownership and avoids a path-permission failure while restoring service.

## 4. Verify port 3000 and nginx

```bash
curl -i http://127.0.0.1:3000/auth
curl -i http://10.200.1.7:8081/_serverFn/
sudo nginx -t && sudo systemctl reload nginx
```

The first request must return an HTTP response rather than `connection refused`. The second may return 404/405 without a specific server-function ID, but it must no longer be an nginx static-file response or 502.

## 5. Deploy frontend files

Your nginx root is:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist
```

After build, sync the generated static output there:

```bash
sudo mkdir -p /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist
sudo rsync -a --delete dist/ /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist/
sudo systemctl reload nginx
```

## 6. Application code adjustment

Update `src/lib/auth-context.tsx` so `role_permission` is requested only after a valid session exists and reloaded when the signed-in user changes. This removes the anonymous `401 Unauthorized` request seen on the login page.

## 7. User creation and tables

After the server starts, create users through **User Management → Create user**. It writes all required records:

```text
auth.users                  email/password login
public.profiles             User ID and profile details
public.user_roles           built-in role assignment
public.user_role_assignment custom role assignment
```

Creating a user only in the Authentication screen does not create the complete User Management record.

## Final browser verification

After a hard refresh:

```text
POST /_serverFn/...                 -> 200
POST /auth/v1/token?...             -> 200
POST /api/public/create-user        -> 200 when admin creates a user
GET  /rest/v1/user_roles?...        -> 200 with assigned role
GET  /rest/v1/role_permission?...   -> 200 after sign-in
```
