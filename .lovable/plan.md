# Fix login on the Quality server

The admin user is now correct in the database (verified: `MASTERADMIN`, `ACTIVE`, role `admin`). The remaining failures are deployment issues, and there are exactly two.

## Diagnosis

**1. `502 Bad Gateway` on `POST /_serverFn/...`**

Nginx now forwards this path correctly (a 405 became a 502), but nothing answers on the upstream port. The application server is not running, so User ID resolution and Create User cannot execute.

**2. `401 Invalid authentication credentials` on `GET /rest/v1/role_permission`**

This message comes from the API gateway rejecting the API key itself, not from a missing session. The frontend build is using an API key that was not signed by this server's `JWT_SECRET`. The Quality stack's own `ANON_KEY` from `backend/.env` must be the one baked into the frontend build.

Both must be fixed; fixing only one leaves login broken.

## Step 1 - Frontend environment

In the frontend `.env` used for the build, the publishable/anon key must be the `ANON_KEY` value from `backend/.env` (the one beginning `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...MqeMZKSY`), and the URL must be the address the browser uses:

```
VITE_SUPABASE_URL=http://10.200.1.7:8081
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
```

Vite bakes these in at build time, so the frontend must be rebuilt and the output re-synced to the Nginx root after any change here.

## Step 2 - Server-side environment

The app server process needs these variables (never with a `VITE_` prefix):

```
SUPABASE_URL=http://127.0.0.1:8001
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from backend/.env>
HOST=127.0.0.1
PORT=3000
```

Without the service role key, User ID login and Create User fail even when the process is running.

## Step 3 - Run the application server

Build the app, then run the server output as a managed service so it survives reboots, listening on `127.0.0.1:3000`. Either a systemd unit or a PM2 entry alongside the existing middleware processes is acceptable — PM2 is already in use on this host, so it is the lower-friction choice.

Confirm before continuing:

```
curl -i http://127.0.0.1:3000/auth
```

This must return `200`, not `Connection refused`. While it refuses, every `/_serverFn/` request stays a 502.

## Step 4 - Nginx

Keep the existing proxy blocks and confirm `/_serverFn/` and `/api/public/` both point at `127.0.0.1:3000`, with `proxy_read_timeout 200s` and `proxy_buffering off` so long SAP-backed calls are not cut off. Reload after any edit.

## Step 5 - Verify in order

1. `curl -i http://127.0.0.1:3000/auth` returns 200.
2. Sign in with **email** `masteradmin@sharviinfotech.com` and its password.
3. Confirm `/rest/v1/role_permission` returns rows instead of 401.
4. Sign in with **User ID** `MASTERADMIN` and confirm `/_serverFn/` returns 200.
5. Confirm the Admin sidebar section is visible.

## What I need from you

To produce the exact files rather than generic instructions, send:

- the frontend `.env` currently used for the build on the server,
- the output of `pm2 ls` after you attempt to start the app,
- the directory listing of the deployed frontend folder (so I can confirm the built server entry path).

## Security note

The database password, JWT secret and both API keys were pasted into chat and should be treated as exposed. Plan a rotation of `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY`, updating the stack and the frontend build together, once login is working.
