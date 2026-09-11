# Restore the Quality backend file on the server and turn on the dashboard login

You deleted `docker-compose.yml` on the server. The correct, complete version is the one in this project at `deployment/Quality/backend/docker-compose.yml` — the same file that shows 07-09-2026 in your WinSCP window. That IS the latest version; nothing newer exists. I validated it here: all 11 services (db, kong, auth, rest, realtime, storage, imgproxy, meta, studio, vector, analytics) parse cleanly.

## Your two questions

1. **"The file date is 07-09, not today"** — correct. The compose file has not changed since 07-09, and that version is the good one. The problem was never the file in the project; it was the edited copy on the server. Copy the project version over and it works.
2. **"localhost is written inside, is that right?"** — yes. Lines like `SITE_URL: ${SITE_URL:-http://localhost:8081}` mean "use the value from your `backend/.env`; if it is missing, fall back to localhost". Your `backend/.env` already sets `SITE_URL=http://10.200.1.7:8081` and `API_EXTERNAL_URL=http://10.200.1.7:8001`, so your real server addresses win. Do not edit the compose file.

## Step 1 - copy the file to the server

In WinSCP (same window you screenshotted), drag:

```text
FROM (left, your PC)   D:\VPCL_Ramky\nfa-sparkle\deployment\Quality\backend\docker-compose.yml
TO   (right, server)   /apps/webapplications/NFA_Approval/Quality/backend/docker-compose.yml
```

Do NOT copy `.env.example` — your real `.env` is already on the server and must stay untouched. Do not open the yml in Notepad afterwards.

## Step 2 - confirm the supporting files are still there

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
ls -1 .env
ls -1 volumes/api/kong.yml volumes/db/00-roles.sh volumes/db/realtime.sql volumes/db/webhooks.sql volumes/db/logs.sql
```

All six must exist. If any are missing, copy them from the same folder on your PC.

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

The database volume `nfa-quality-db-data` is reused, so your 10 users, 28 permission rows and all data stay as they are. `supabase-dev-*` and `supabase-prod-*` are untouched.

## Step 5 - repair the internal database password (fixes the Studio error)

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/fix-db-roles.sh
```

Then confirm `nfa-quality-meta` and `nfa-quality-studio` show `healthy`:

```bash
docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
```

## Step 6 - make the dashboard ask for a username and password

The dashboard has no built-in login screen, so the prompt comes from the web server in front of it.

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-admin   # type the password twice
```

Open the Quality site file (`/etc/nginx/sites-available/enfa-quality.conf` or the copy under `/apps/webapplications/NFA_Approval/nginx/`) and add these two lines inside the `server` block that has `listen 8082;`, just above `location / {`:

```nginx
    auth_basic           "eNFA Quality dashboard";
    auth_basic_user_file /etc/nginx/enfa-quality-studio.htpasswd;
```

Apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://10.200.1.7:8082` in a private window — it asks for `enfa-admin` and your password, and the users and tables load.

## Step 7 - run the migrations (only if tables are missing)

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh
```

It reads the password from `backend/.env` itself. Never paste placeholder text in angle brackets, and do not run `. ./.env`.

## What changes in this project

Nothing. The compose file here is already correct and validated; this plan is the server procedure only. On approval I will add a short "restoring the backend file" section to `deployment/README.md` so this copy step is written down for next time.

## Safety

- No application code changes, nothing is built on the server.
- The existing database volume and all its data are preserved.
- Only `nfa-quality-*` containers are started; DEV and PROD stacks, their ports and volumes are not touched.
