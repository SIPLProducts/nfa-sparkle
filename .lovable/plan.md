# Fix Quality-server build and restore login

## Confirmed root cause

The project is not a pure static SPA: login calls the `resolveLoginId` server function, and Create User plus `/api/public/*` also require the app server.

The current Ubuntu build produces `dist/index.html` but no server entry because `vite.config.ts` explicitly sets `nitro: false` outside Lovable. Consequently, `scripts/pack-dist.mjs` has no `dist/server` bundle to move, and `.output/server/server.js` cannot exist.

The installed Node deployment preset produces this entry:

```text
dist/                    static browser files served by Nginx
.output/server/index.mjs Node app server for /_serverFn/* and /api/public/*
```

This explains the complete failure chain: no server bundle → no process on port 3000 → Nginx returns 502 for `/_serverFn/*` → User ID/email resolution does not complete → authenticated role requests fail.

## Do not apply the proposed Nginx workaround

Do **not** add:

```nginx
error_page 405 =200 $uri;
```

That converts failed POST requests into fake `200` responses containing HTML. The browser expects a server-function response and will fail while hiding the true error.

Also do not send every `/api/` request to port 3005. `/api/public/*` belongs to the app server on port 3000; port 3005 is only the SAP proxy middleware.

## Step 1 — Correct the self-hosted build configuration

Update `vite.config.ts` so self-hosted builds enable the Node server preset instead of setting `nitro: false`:

```ts
nitro: { preset: "node-server" }
```

Lovable builds retain their platform-managed setting. Ubuntu builds retain SPA/static `index.html` generation while also producing the required Node runtime.

Update `scripts/pack-dist.mjs` so it continues flattening browser output into `dist/` without replacing or deleting Nitro's `.output/server` result.

Update every deployment reference from the nonexistent `.output/server/server.js` to the Node preset's actual entry, `.output/server/index.mjs`:

- `deploy/scripts/deploy-quality.sh`
- `deploy/systemd/enfa-app.service`
- deployment documentation and environment comments that name the old entry

## Step 2 — Deploy the corrected files and rebuild

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
ls -la .output/server/index.mjs
```

Both final files must exist. If `index.mjs` is still missing, capture the full output of `npm run build`; do not continue to PM2 or modify Nginx.

The Quality `.env` must keep the Quality backend URL and keys. Do not use the cloud values from the repository `.env`, and never place the service-role key in a `VITE_*` variable.

## Step 3 — Start the missing app process with PM2

PM2 currently contains only three middleware processes. Start the app server as a fourth process:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
set -a
. ./.env
set +a
pm2 start .output/server/server.js \
pm2 start .output/server/index.mjs \
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

Remove the obsolete `pm2 start .output/server/server.js` line if it was previously attempted; the only valid start command is for `index.mjs`.

Expected: port 3000 answers and PM2 shows `NFA-Portal-App` as `online`. If it exits, the 100 log lines identify the exact startup error.

## Step 4 — Keep the correct Nginx routing

Keep static assets in `dist`, but route runtime requests separately:

```nginx
server {
    listen 8081;
    server_name 10.200.1.7;

    root /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist;
    index index.html;
    client_max_body_size 50m;

    # TanStack server functions and application APIs
    location ~ ^/(_serverFn|api)/ {
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

The repository’s `deploy/nginx/nfa-quality.conf` already follows this structure: static browser files are served from `dist`, while `/_serverFn/*` and `/api/*` go to port 3000. Do not add `error_page 405 =200` and do not proxy the application `/auth` page to the backend gateway.

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