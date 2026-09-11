# Restore the Quality backend file on the server and turn on the dashboard login

You deleted `docker-compose.yml` on the server. The correct, complete version already exists in this project at `deployment/Quality/backend/docker-compose.yml` (457 lines, validated — all 11 services parse cleanly: db, kong, auth, rest, realtime, storage, imgproxy, meta, studio, vector, analytics).

That file is written for the server: every path inside it is relative to the backend folder (`./volumes/api/kong.yml`, `./volumes/db/*.sql`), all containers are named `nfa-quality-*`, the network is `nfa-quality-net`, and every port is bound to `127.0.0.1` only. Nothing in it is "local only". Copying it to the server as-is is all that is needed.

## Step 1 - copy the file to the server

From your Windows machine (WinSCP, or `scp` from VS Code terminal), copy:

```text
FROM (local project)  deployment/Quality/backend/docker-compose.yml
TO   (server)         /apps/webapplications/NFA_Approval/Quality/backend/docker-compose.yml
```

Same method you already use for `frontend/dist`. Do not edit it in Notepad afterwards - that is what broke the indentation last time.

## Step 2 - confirm the supporting files are still there

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
ls -1 .env
ls -1 volumes/api/kong.yml volumes/db/00-roles.sh volumes/db/realtime.sql volumes/db/webhooks.sql volumes/db/logs.sql
```

All six must exist. If any are missing, copy them from the same folder in the project.

## Step 3 - validate

```bash
docker compose -p nfa-quality --env-file .env config -q
echo "exit code: $?"
```

Continue only when the exit code is `0`.

## Step 4 - start only the Quality services

```bash
docker compose -p nfa-quality --env-file .env up -d
docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
```

The database volume `nfa-quality-db-data` is reused, so your 10 users, 28 permission rows and all data stay exactly as they are. The `supabase-dev-*` and `supabase-prod-*` containers are untouched.

## Step 5 - repair the internal database password (fixes the Studio error)

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/fix-db-roles.sh
```

Wait for it to finish, then confirm:

```bash
docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
```

`nfa-quality-meta` and `nfa-quality-studio` must show `healthy`. If meta is still restarting:

```bash
docker logs nfa-quality-meta --tail 40
```

## Step 6 - make the dashboard ask for a username and password

The dashboard has no built-in login screen, so the prompt comes from the web server in front of it.

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-admin   # type the password twice
```

Then open the Quality site file (`/etc/nginx/sites-available/enfa-quality.conf` or the copy under `/apps/webapplications/NFA_Approval/nginx/`) and add these two lines inside the `server` block that has `listen 8082;`, just above `location / {`:

```nginx
    auth_basic           "eNFA Quality dashboard";
    auth_basic_user_file /etc/nginx/enfa-quality-studio.htpasswd;
```

Apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://10.200.1.7:8082` in a private window - it now asks for `enfa-admin` and your password, and the tables and users load.

## Step 7 - run the migrations (only if tables are missing)

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh
```

It reads the password from `backend/.env` itself. Never paste the placeholder text in angle brackets, and do not use `. ./.env`.

## What changes in this project

Nothing. The compose file here is already correct and validated; this plan is the server procedure only. If you approve, I will also add a short "restoring the backend file" section to `deployment/README.md` so the copy step is written down for next time.

## Safety

- No application code is changed and nothing is built on the server.
- The existing database volume and all its data are preserved.
- Only `nfa-quality-*` containers are started; DEV and PROD stacks, their ports and volumes are not touched.
