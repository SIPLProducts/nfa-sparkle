# Consolidate nginx quality config into one file with upstream blocks

Refactor `deploy/nginx/nfa-quality.conf` so the entire quality-server nginx setup lives in a single, self-contained file with shared upstream definitions at the top and four clean server blocks below.

## What I will change

1. Keep everything in `deploy/nginx/nfa-quality.conf` (one file, no includes).
2. Add `upstream` blocks at the top for each backend:
   - `enfa_app` → `127.0.0.1:3000`
   - `supabase_kong` → `127.0.0.1:54321`
   - `supabase_studio` → `127.0.0.1:54323`
   - `sap_middleware` → `127.0.0.1:3005`
3. Keep the existing `map $http_upgrade $connection_upgrade` directive.
4. Replace each `proxy_pass http://127.0.0.1:XXXX` with the matching upstream name.
5. Preserve all current behaviour:
   - Public ports 8081, 8001, 8082, 3004
   - WebSocket upgrade headers
   - `client_max_body_size` values (25m app/middleware, 50m Supabase)
   - 200s proxy timeouts for app and middleware, 120s for Supabase
   - IP allow/deny block on Studio
   - Access/error log paths
6. Update the quick-reference table in `deploy/README.md` to note the file is self-contained.

## Files to edit

- `deploy/nginx/nfa-quality.conf`
- `deploy/README.md` (one-line note update)

## Out of scope

- No port changes.
- No new files or split includes.
- No application source code changes.
