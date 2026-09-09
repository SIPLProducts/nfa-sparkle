# Fix the three Quality server problems

All three symptoms come from the same two root causes: the API keys in
`backend/.env` do not match the `JWT_SECRET`, and the app process on 8081 was
started without the server-side keys.

## Symptom 1 - 401 Unauthorized on `/rest/v1/role_permission` after login

That `{"message":"Unauthorized","request_id":...}` shape is the API gateway
rejecting the key the browser sent. The gateway accepts exactly the `ANON_KEY`
and `SERVICE_ROLE_KEY` values from `backend/.env`; the browser bundle was built
with a different (invalid) key. Correct keys + rebuild clears this.

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

1. **New `deployment/Quality/scripts/sync-frontend-env.sh`** - copy the correct
   URL and both keys from `backend/.env` into `frontend/.env` (creating it from
   the example when missing), never printing values, refusing placeholder text
   and keys that do not match `JWT_SECRET`.
2. **New `deployment/Quality/scripts/check-app-env.sh`** - report present/missing
   (never values) for the required variables on the actually running app process,
   so this is diagnosed in one command.
3. **`deployment/Quality/scripts/deploy-quality.sh`** - run the env sync and the
   presence check before building, fail early with a clear message, and restart
   the app with the env file applied.
4. **`deployment/nginx/enfa-quality.conf`** - already updated to require a
   password file on 8082; the README will carry the one-time setup command.
5. **`deployment/README.md`** - one ordered recovery procedure for all three.

`generate-keys.sh` and `fix-db-roles.sh` already exist and are used as-is.

## What you will run on the server

```text
SRC=/apps/webapplications/NFA_Approval/Quality/src
Q=/apps/webapplications/NFA_Approval/Quality
cp $SRC/deployment/Quality/scripts/* $Q/scripts/ && chmod +x $Q/scripts/*.sh
cp $SRC/deployment/nginx/enfa-quality.conf /apps/webapplications/NFA_Approval/nginx/
cd $Q

./scripts/generate-keys.sh        # paste BOTH printed keys into backend/.env
./scripts/fix-db-roles.sh         # let it finish, do not press Ctrl+C
./scripts/run-migrations.sh       # only after the repair reports success

./scripts/sync-frontend-env.sh    # copies the corrected keys into frontend/.env
./scripts/deploy-quality.sh       # rebuild (new browser key) + restart
./scripts/check-app-env.sh        # confirms the running app has the service key

# Dashboard login prompt, one time
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-quality-admin
sudo nginx -t && sudo systemctl reload nginx
```

The rebuild in step `deploy-quality.sh` is required: the browser key is baked
into the built files, so a key change without a rebuild keeps returning 401.

## Safety boundary

Only Quality scripts, the Quality nginx file and Quality documentation change.
No application source code, no data deletion, and no other application,
container, port, or volume is touched.
