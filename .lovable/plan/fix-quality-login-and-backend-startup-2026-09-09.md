# Fix Quality login and backend startup

## Confirmed causes

1. **Login page:** the Node app returns `/auth` and every referenced CSS/JavaScript file with HTTP 200, while Nginx returns HTTP 404 for the exact same `/assets/*` URLs. The browser therefore receives HTML but cannot start the application, so `/` remains on `Loading…` and `/auth` is unstyled.
2. **Backend:** the existing Quality database volume was initialized before the corrected role bootstrap. Auth connects as `supabase_auth_admin`; Realtime and Meta connect as `supabase_admin`. Their stored database passwords do not match the current Quality `.env`, so all three fail health checks. Changing the initialization file alone cannot repair an existing volume.

## 1. Make login assets work immediately

- Change only the Quality Nginx `/assets/` location to proxy to the already-working Node app on `127.0.0.1:3000` instead of reading a mismatched static folder.
- Preserve immutable caching and all existing API, backend, middleware, upload, and port behavior.
- Add proxy headers to the page-rendering location and keep `/auth/v1/*` routed to the Quality backend.
- Provide activation checks using `nginx -T` so the server verifies the active config, not merely the file being edited.

Expected result after copying the revised config and reloading Nginx:

```text
http://127.0.0.1:8081/assets/styles-....css  -> 200
http://10.200.1.7:8081/auth                -> styled login page
http://10.200.1.7:8081/                    -> login redirect for signed-out users
```

## 2. Permanently correct the build package

- Update `scripts/pack-dist.mjs` so one build creates a self-contained `dist/` with:
  - `dist/assets`, icons, favicons, and manifest for Nginx;
  - the same files under `dist/public/` for the Node server;
  - `dist/server/index.mjs` for PM2.
- Add post-build assertions so an incomplete package fails immediately.
- Package the Ramky logo as a self-hosted file rather than a Lovable-only asset URL.
- Update the Quality deployment script/document so a release replaces the complete old `dist` folder rather than merging hashed builds.

## 3. Repair the existing Quality database safely

- Add a Quality-only repair script that reads `POSTGRES_PASSWORD` from the existing backend `.env` without printing it.
- Execute SQL inside `nfa-quality-db` as the local `postgres` administrator and synchronize these existing roles:
  - `supabase_auth_admin`
  - `supabase_admin`
  - `authenticator`
  - `supabase_storage_admin`
  - `supabase_functions_admin`
  - `supabase_read_only_user`
  - `pgbouncer` when present
- Restart only `nfa-quality-auth`, `nfa-quality-realtime`, and `nfa-quality-meta`, then start the remaining `nfa-quality` services.
- Do **not** delete the database volume unless the database is confirmed disposable and the live repair cannot succeed.

## 4. Diagnose any remaining container-specific failure

After password synchronization, capture separate fresh logs and health states for Auth, Realtime, and Meta. Correct only a remaining service-specific configuration proven by those logs, such as a missing Realtime secret. Verify required `.env` values are populated by checking presence/length only—never print secrets.

## 5. Verification

- Nginx and Node both return 200 for every CSS/JavaScript URL referenced by `/auth`.
- `/auth` displays the styled login screen and local logo; `/` no longer stays on `Loading…`.
- `nfa-quality-auth`, `nfa-quality-realtime`, and `nfa-quality-meta` become healthy.
- Kong starts, `http://127.0.0.1:8001/auth/v1/health` responds, and login reaches the Quality backend.
- Only `nfa-quality-*`, port 8081 configuration, and this application’s PM2 process are touched; existing applications, containers, ports, and shared Nginx files remain unchanged.