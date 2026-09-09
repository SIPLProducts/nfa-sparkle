# Fix `/` stuck on Loading and make Quality deployment match the server

## Confirmed diagnosis

- `http://10.200.1.7:8081/auth` now opens, so Nginx can reach the Node app and the login page assets are present.
- `/` is a different page: `src/routes/index.tsx` is the protected Dashboard. It initially renders `Loading…` and only redirects to `/auth` inside a browser-side effect after authentication finishes.
- Therefore, when that authentication startup or redirect does not complete on the deployed build, `/` remains on `Loading…`, even though opening `/auth` directly works.
- The server has only `Quality/frontend/dist` and `dist_09-09-2026`; it does not have the project source at `Quality/src`. Application-code changes must therefore be built on the machine containing the latest project and the complete new `dist` uploaded to the server.
- `nginx -t` also fails because this server does not support the IPv6 `listen [::]:...` entries.

## Changes

### 1. Make `/` redirect reliably

Update `src/routes/index.tsx` so an unauthenticated visitor is sent to `/auth` as soon as authentication resolves, using the router's render-safe redirect/navigation behavior instead of continuing to return the permanent-looking `Loading…` screen.

- Keep the Dashboard at `/` for signed-in users.
- Keep the loading screen only while authentication is genuinely being checked.
- Preserve all Dashboard data, filters, tabs, and existing functionality.

### 2. Prevent authentication startup from hanging forever

Update the auth startup in `src/lib/auth-context.tsx` so its initial loading state always completes even if session retrieval fails.

- Handle the session-read error explicitly.
- Clear the session/user and finish loading on failure, allowing `/` to redirect to `/auth`.
- Preserve role loading, token refresh, sign-out, and existing authenticated behavior.

### 3. Make the Quality Nginx file compatible with this Ubuntu server

In `deployment/nginx/enfa-quality.conf`, remove only the four IPv6 `listen [::]:...;` entries. Keep all IPv4 ports and existing app/static/backend/Studio/middleware routing unchanged.

### 4. Correct the deployment guide for the actual server layout

Update `deployment/README.md` and the deploy-script preflight guidance:

- State clearly that `Quality/frontend/dist` is a built release, not a source checkout.
- Build on the latest project machine with `npm install && npm run build`.
- Upload the **whole generated `dist` folder** to a temporary server folder and atomically replace `Quality/frontend/dist`, retaining the current release for rollback.
- Restart only `enfa-quality-app`, test Nginx, reload it, and verify `/`, `/auth`, CSS/JS assets, and the logo.
- Do not use the failed `Quality/src` copy commands unless a real source checkout is intentionally added later.

## Verification

1. Local signed-out visit to `/` ends at `/auth`; no indefinite `Loading…`.
2. Local signed-in visit to `/` still opens the Dashboard.
3. Build output contains `server/index.mjs`, hashed files under `assets/`, and matching static files under both root and `public/`.
4. On Ubuntu, `nginx -t` passes without IPv6 socket errors.
5. After replacing `dist` and restarting `enfa-quality-app`:
   - `/` redirects to `/auth` when signed out.
   - `/auth` is styled and interactive.
   - every CSS/JS URL referenced by `/auth` returns HTTP 200.
   - `/ramky-logo.png` returns HTTP 200.

## Safety

Only root authentication handling, authentication startup error handling, the Quality Nginx file, and Quality deployment instructions are changed. Dashboard behavior for signed-in users, API integrations, other applications, containers, ports, and volumes remain untouched.
