# Fix the Quality dashboard error and the missing dashboard login prompt

## What I confirmed from your settings file

1. **Your two API keys are invalid.** I recalculated both `ANON_KEY` and `SERVICE_ROLE_KEY` against your `JWT_SECRET`: neither signature matches. They are leftover sample keys, so every part of the stack that authenticates with them is broken. These must be regenerated from your current `JWT_SECRET`.
2. **The internal database password is out of sync.** The dashboard error `password authentication failed for user "supabase_admin"` means the database volume still holds an older password than the one now in the settings file.
3. **The dashboard asks for no username/password by design in the current setup.** The username/password you set are enforced by the API gateway, but the dashboard address (8082) is proxied straight to the dashboard container, bypassing that gateway. So the credentials are never requested. This is also why the admin screen is currently open to anyone on your network.

## Changes

1. **`deployment/Quality/scripts/fix-db-roles.sh`**
   - Take the intended password from the Quality settings file rather than from the running container, so a changed password is actually applied (never printed).
   - Reset all internal database role passwords to that value.
   - Recreate (not merely restart) only the Quality services, so they pick up the corrected settings.
   - Verify a real `supabase_admin` login and dashboard-schema health before reporting success; print the relevant container log instead of a false success.

2. **New `deployment/Quality/scripts/generate-keys.sh`**
   - Print a correctly signed `ANON_KEY` and `SERVICE_ROLE_KEY` for the `JWT_SECRET` already in the settings file, and warn if the existing keys do not match.

3. **`deployment/nginx/enfa-quality.conf`**
   - Add password protection to the dashboard on port 8082 using an nginx password file, keeping the existing network restriction. The dashboard will then prompt for the username and password.

4. **`deployment/README.md`**
   - One clear ordered recovery procedure covering key regeneration, role repair, verification, and the dashboard password file.

## Exact steps you will run afterwards

```text
cd /apps/webapplications/NFA_Approval/Quality

# 1. Generate valid API keys and paste them into backend/.env
./scripts/generate-keys.sh

# 2. Apply the corrected settings and repair the database roles
./scripts/fix-db-roles.sh

# 3. Only when step 2 reports success
./scripts/run-migrations.sh

# 4. Turn on the dashboard login prompt (one time)
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/enfa-quality-studio.htpasswd enfa-quality-admin
sudo nginx -t && sudo systemctl reload nginx
```

Then reload `http://10.200.1.7:8082`: it will ask for the username and password, and the Table Editor will list your tables.

## Important note about the frontend

Changing `ANON_KEY` means the application build must be updated with the new key too, because it is baked into the built files. The README will state exactly which value to update in `frontend/.env` and that a rebuild and redeploy of `dist/` follows.

## Safety boundary

No data is deleted and no volume is recreated. Only Quality role passwords, Quality containers, the Quality nginx file, and Quality documentation are affected. No other application, container, port, or volume is touched, and no application source code changes.
