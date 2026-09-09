# Fix the dashboard password error and the login error on port 8081

Two separate problems, in this order.

## 1. Dashboard: "password authentication failed for user supabase_admin"

The internal database passwords in the existing Quality database volume are older
than the values now in `backend/.env`, and the API keys in `backend/.env` do not
match the `JWT_SECRET`. Until both are corrected, the dashboard keeps failing.
The repair scripts for this already exist in the repo but have not been run to
completion on the server yet.

## 2. Login: "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"

Sign-in first calls a server-side step that resolves the User ID to an email, and
that step needs the service key on the running Node app process. The message means
the Quality app process on 8081 is running without `SUPABASE_SERVICE_ROLE_KEY` -
either `frontend/.env` still holds the placeholder text, or the process was started
without that file. Nothing in the application code is wrong.

## Repo changes

1. **New `deployment/Quality/scripts/sync-frontend-env.sh`**
   - Copy the correct URL, publishable key and service key from `backend/.env` into
     `frontend/.env` (creating it from the example if missing), never printing values.
   - Refuse placeholder text and refuse keys that do not match `JWT_SECRET`.
   - Report whether a frontend rebuild is required (it is, whenever the browser key
     changes, because that value is baked into the built files).

2. **New `deployment/Quality/scripts/check-app-env.sh`**
   - Report, for the actually running app process, whether each required value is
     present (present/missing only, never the value), so this failure is diagnosed
     in one command instead of by guessing.

3. **`deployment/Quality/scripts/deploy-quality.sh`**
   - Run the env sync and the presence check before building, and fail early with a
     clear message rather than shipping a build that cannot sign anyone in.
   - Restart the app with the env file applied so a running process picks up the key.

4. **`deployment/README.md`**
   - One ordered recovery procedure covering both problems.

## What you will run on the server

```text
SRC=/apps/webapplications/NFA_Approval/Quality/src
Q=/apps/webapplications/NFA_Approval/Quality
cp $SRC/deployment/Quality/scripts/* $Q/scripts/ && chmod +x $Q/scripts/*.sh
cd $Q

# Problem 1 - dashboard
./scripts/generate-keys.sh        # paste both printed keys into backend/.env
./scripts/fix-db-roles.sh         # let it finish, do not press Ctrl+C
./scripts/run-migrations.sh       # only after the repair reports success

# Problem 2 - login
./scripts/sync-frontend-env.sh    # copies the corrected keys into frontend/.env
./scripts/deploy-quality.sh       # rebuild + restart with the keys applied
./scripts/check-app-env.sh        # confirms the running app has the service key
```

Then reload `http://10.200.1.7:8082` (dashboard) and `http://10.200.1.7:8081/auth`
(login).

## Safety boundary

Only Quality scripts and Quality documentation change. No application source code,
no data deletion, and no other application, container, port, or volume is touched.
