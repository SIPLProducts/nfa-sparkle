# Fix Quality-server login with the required app server

## Confirmed architecture

The suggested “pure static SPA” diagnosis is incorrect for this project.

The build intentionally produces two outputs:

```text
dist/                    static browser files served by Nginx
.output/server/server.js Node app server for /_serverFn/* and /api/public/*
```

`scripts/pack-dist.mjs` moves `dist/server` into the hidden `.output/server` directory. Therefore, running `ls dist` only shows static files by design; it does not prove that the app is static-only.

Login calls `resolveLoginId`, which is a TanStack server function. User creation and SAP-facing APIs also use server routes. They cannot run from `index.html` or the SAP middleware.

## Do not apply the proposed Nginx workaround

Do **not** add:

```nginx
error_page 405 =200 $uri;
```

That converts failed POST requests into fake `200` responses containing HTML. The browser expects a server-function response and will fail while hiding the true error.

Also do not send every `/api/` request to port 3005. `/api/public/*` belongs to the app server on port 3000; port 3005 is only the SAP proxy middleware.

## Step 1 — Check the hidden server output

From the application source folder, not inside `dist`:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
ls -la .output/server/server.js
```

If it exists, continue to Step 3.

If it does not exist, continue to Step 2.

## Step 2 — Rebuild both outputs

First ensure the app `.env` in this same source folder has:

```env
HOST=127.0.0.1
PORT=3000
NODE_ENV=production

SUPABASE_PROJECT_ID=self-hosted-quality
SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<Quality SERVICE_ROLE_KEY>

VITE_SUPABASE_PROJECT_ID=self-hosted-quality
VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<Quality ANON_KEY>
```

Then rebuild from the source folder:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
npm ci
npm run build
ls -la dist/index.html
ls -la .output/server/server.js
```

Both final files must exist. The Quality keys shown in the latest environment already match the backend keys; do not replace them with the cloud-project keys from the repository `.env`.

## Step 3 — Start the missing app process with PM2

PM2 currently contains only three middleware processes. Start the app server as a fourth process:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
set -a
. ./.env
set +a
pm2 start .output/server/server.js \
  --name NFA-Portal-App \
  --cwd /opt/Ramky_Applications/NFA-Approval/Quality/frontend \
  --time
pm2 save
pm2 ls
```

Then verify:

```bash
curl -i http://127.0.0.1:3000/auth
pm2 logs NFA-Portal-App --lines 100
```

Expected: port 3000 answers and PM2 shows `NFA-Portal-App` as `online`. If it exits, the 100 log lines identify the exact startup error.

## Step 4 — Use the correct Nginx routing

Keep static assets in `dist`, but route runtime requests separately:

```nginx
server {
    listen 8081;
    server_name 10.200.1.7;

    root /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist;
    index index.html;
    client_max_body_size 50m;

    # TanStack server functions and application APIs
    location ~ ^/(_serverFn|api/public)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 200s;
        proxy_send_timeout 200s;
        proxy_buffering off;
    }

    # Quality backend API through its gateway
    location ~ ^/(auth|rest|realtime|storage)/v1/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }

    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Do not use `location /auth/` for the backend: `/auth` is the application's login page, while `/auth/v1/` is the backend auth API. The exact `/auth/v1/` match prevents the login page from being proxied incorrectly.

Apply and verify:

```bash
nginx -t
systemctl reload nginx
curl -i http://127.0.0.1:3000/auth
curl -i http://10.200.1.7:8081/auth
```

## Step 5 — Clear the old session and sign in

The browser previously used a cloud-issued session against the Quality backend, which can produce `Invalid authentication credentials`.

1. Chrome DevTools → Application → Storage → Clear site data for `10.200.1.7:8081`.
2. Hard refresh.
3. Sign in with `masteradmin@sharviinfotech.com` and the password configured for that Quality auth account.
4. Confirm `POST /_serverFn/*` returns 200 rather than 502.
5. Confirm `/rest/v1/role_permission` returns permission rows rather than 401.
6. Then verify User ID login with `MASTERADMIN`.

## Existing local users

The database can copy profile fields and roles, but not recover users’ original plaintext passwords. Create each auth account in the Quality Authentication Users screen with a temporary password and Auto Confirm enabled, then run the profile/role migration query already provided. The verified Master Admin user is already complete and does not need to be recreated.

## Security follow-up

The database password, JWT secret and API keys shown in chat must be treated as exposed. After login is restored, rotate them together and rebuild/restart all dependent services. Do not paste the replacements into chat.