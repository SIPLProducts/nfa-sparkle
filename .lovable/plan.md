# Fix the three Quality server problems

The configured key values may be correct. The failures can still occur when the
running gateway, the browser build, and the app process are not using those same
values. The repair will verify each runtime copy before changing anything.

## Symptom 1 - 401 Unauthorized on `/rest/v1/role_permission` after login

That `{"message":"Unauthorized","request_id":...}` shape is the API gateway
rejecting the `apikey` sent by the browser. Even if `backend/.env` is correct,
Kong may still be running with its previous environment and the browser may still
contain the key from its previous build. The fix compares fingerprints (never
the secrets themselves) for all three locations, then recreates Kong and rebuilds
the browser only when a mismatch is confirmed.

## Symptom 2 - Dashboard: password authentication failed for supabase_admin

The internal database role passwords in the existing Quality data volume are
older than the value now in `backend/.env`. The roles must be reset to the
current value and the affected Quality services recreated.

## Symptom 3 - The dashboard never asks for a username and password

The dashboard credentials are enforced by the API gateway on 8001, but port 8082
proxies straight to the dashboard container and bypasses it. A password prompt
must be added on 8082 itself.

## Also fixed: `SUPABASE_SERVICE_ROLE_KEY` missing on the running app

Your pm2 log repeats this on every sign-in. The app process has no service key,
because `frontend/.env` still holds placeholder text or the process was started
without that file.

## What your container list shows

`nfa-quality-studio` and `nfa-quality-meta` are unhealthy - that is the same
password problem, and the role repair plus recreate is what clears it.

`nfa-quality-realtime` is restarting, but so are the realtime containers in both
of your other, unrelated stacks (`supabase-dev` and `supabase-prod`). That points
to a host-wide cause, not something specific to Quality, and the Quality app does
not use realtime. The repair script will print the Quality realtime log so we can
see its actual reason; I will not touch the other two stacks.

## Repo changes

1. **New `deployment/Quality/scripts/verify-runtime-keys.sh`** - validate the
   configured keys against `JWT_SECRET`, compare safe fingerprints from
   `backend/.env`, the running Kong container, `frontend/.env`, and the running
   app process, and run an actual `/rest/v1/` request using the configured anon
   key. This identifies the exact stale copy before repair.
2. **New `deployment/Quality/scripts/sync-frontend-env.sh`** - copy the correct
   URL and both keys from `backend/.env` into `frontend/.env` (creating it from
   the example when missing), never printing values, refusing placeholder text
   and keys that do not match `JWT_SECRET`.
3. **New `deployment/Quality/scripts/check-app-env.sh`** - report present/missing
   (never values) for the required variables on the actually running app process,
   so this is diagnosed in one command.
4. **`deployment/Quality/scripts/deploy-quality.sh`** - support your actual
   deployment model: `dist` is built in local VS Code and copied into
   `Quality/frontend/dist`. It will not install packages or build on the server.
   It will validate the copied `dist`, validate `frontend/.env`, and restart only
   `enfa-quality-app` with that environment applied.
5. **`deployment/nginx/enfa-quality.conf`** - already updated to require a
   password file on 8082; the README will carry the one-time setup command.
6. **`deployment/README.md`** - one ordered recovery procedure for all three.

`generate-keys.sh` and `fix-db-roles.sh` already exist and are used as-is.

## What you will run on the server

```text
SRC=/apps/webapplications/NFA_Approval/Quality/src
Q=/apps/webapplications/NFA_Approval/Quality
cp $SRC/deployment/Quality/scripts/* $Q/scripts/ && chmod +x $Q/scripts/*.sh
cp $SRC/deployment/nginx/enfa-quality.conf /apps/webapplications/NFA_Approval/nginx/
cd $Q

./scripts/verify-runtime-keys.sh  # proves which running copy differs
./scripts/generate-keys.sh        # only replace keys if validation says invalid
./scripts/fix-db-roles.sh         # let it finish, do not press Ctrl+C
./scripts/run-migrations.sh       # only after the repair reports success

./scripts/sync-frontend-env.sh    # copies the corrected keys into frontend/.env
SKIP_BUILD=1 ./scripts/deploy-quality.sh  # uses your already-copied dist + restarts
./scripts/check-app-env.sh        # confirms the running app has the service key

# Dashboard login prompt, one time
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-quality-admin
sudo nginx -t && sudo systemctl reload nginx
```

If the verification proves that the copied `dist` contains a different browser
key, rebuild once in local VS Code with the correct `VITE_*` values and replace
`Quality/frontend/dist`. No build will be run on the Ubuntu server.

## Safety boundary

Only Quality scripts, the Quality nginx file and Quality documentation change.
No application source code, no data deletion, and no other application,
container, port, or volume is touched.
