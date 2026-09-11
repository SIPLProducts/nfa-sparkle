# Fix Quality backend compose interpolation error

## Problem

`docker compose -p nfa-quality --env-file .env config -q` fails with:

```text
invalid interpolation format for x-common-env.SUPABASE_PUBLIC_URL.
You may need to escape any $ with another $.
${SUPABASE_PUBLIC_URL:http://10.200.1.7:8001}
```

The server `docker-compose.yml` contains `${VAR:http://...}` instead of the valid `${VAR:-http://...}` syntax. The `-` is missing before the default value, so Docker treats the URL as an interpolation modifier and errors.

## Root cause

The compose file on the server was edited/corrupted. The project copy at `deployment/Quality/backend/docker-compose.yml` uses the correct `${VAR:-default}` form with `localhost` fallbacks. Your `backend/.env` is supposed to override those fallbacks with the server IP.

## Fix steps

### Step 1 — Replace the damaged compose file from the project copy

Use WinSCP to copy the validated project file over the damaged server file:

```text
FROM (your PC)   D:\VPCL_Ramky\nfa-sparkle\deployment\Quality\backend\docker-compose.yml
TO   (server)   /apps/webapplications/NFA_Approval/Quality/backend/docker-compose.yml
```

Do NOT open the file in Notepad before copying — Notepad can strip or alter characters.

### Step 2 — Verify the syntax is now correct

On the server:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env config -q && echo OK
```

Expected result: `OK` and exit code `0`.

### Step 3 — Confirm your `.env` overrides the fallbacks

Still in `/apps/webapplications/NFA_Approval/Quality/backend`, run:

```bash
cat .env | grep -E '^(SITE_URL|API_EXTERNAL_URL|SUPABASE_PUBLIC_URL)='
```

Expected output should show:

```text
SITE_URL=http://10.200.1.7:8081
API_EXTERNAL_URL=http://10.200.1.7:8001
SUPABASE_PUBLIC_URL=http://10.200.1.7:8001
```

If any of these are missing, add them to `.env`. The compose file's `${VAR:-http://localhost:...}` fallbacks will then only be used if the `.env` value is absent.

### Step 4 — Recreate only the Quality services

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env up -d --force-recreate
```

This preserves the existing `nfa-quality-db-data` volume, so users, roles and data are not lost.

### Step 5 — Repair internal database roles

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/fix-db-roles.sh
```

Then check health:

```bash
docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
```

`nfa-quality-meta` and `nfa-quality-studio` should become healthy.

### Step 6 — Run migrations if needed

```bash
cd /apps/webapplications/NFA_Approval/Quality
./scripts/run-migrations.sh
```

### Step 7 — Add dashboard login on port 8082

Studio has no built-in login page. Nginx must enforce Basic Auth:

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-admin
```

Enter the dashboard password twice when prompted.

Then open `/etc/nginx/sites-available/enfa-quality.conf` (or the copy under `/apps/webapplications/NFA_Approval/nginx/`) and ensure these two lines exist inside the `server` block that has `listen 8082;`, just above `location / {`:

```nginx
    auth_basic           "eNFA Quality dashboard";
    auth_basic_user_file /etc/nginx/enfa-quality-studio.htpasswd;
```

Apply:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://10.200.1.7:8082` in a private window — it should now ask for `enfa-admin` and your password.

## What this plan changes in the project

Nothing. This is a server-side file replacement and configuration fix. The project copy of `deployment/Quality/backend/docker-compose.yml` is already correct and validated.

## Safety

- Only `nfa-quality-*` containers are touched. Existing DEV/PROD stacks, their ports and volumes are not changed.
- The Quality database volume is reused, so all existing data is preserved.
- No application source code is modified.
- No build or package install is run on the Ubuntu server.
