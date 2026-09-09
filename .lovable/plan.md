# Fix Quality login, permissions data, and Studio database access

The server contains the prebuilt `frontend/dist` release only. Nothing will be
copied from a server-side source folder, and nothing will be built on Ubuntu.
Application changes are built locally in VS Code, then the replacement `dist`
is uploaded to the existing Quality frontend folder.

## Confirmed findings

- The application currently requests `role_permission` as soon as the login page
  loads, before a user session exists. The table intentionally allows reads only
  to authenticated users, so this request must not run before sign-in.
- The schema migration creates `role_permission`, grants authenticated read
  access, enables row security, and seeds the standard permissions.
- `9000_data_import.sql` contains 28 `role_permission` rows, plus the existing
  users, profiles, and role assignments. Whether that migration completed on
  the Quality server still needs to be checked against the actual database.
- The Studio screenshot is a separate database-connection failure:
  `supabase_admin` cannot authenticate. Studio cannot be used to judge whether
  tables or rows exist until that internal role password is repaired.
- A gateway/browser key mismatch can also return `401` before the database is
  reached. The configured key, running Kong key, and key embedded in `dist`
  must be compared without exposing their values.

## Repair plan

### 1. Repair Studio and database service access first

Use plain server commands to read the Quality password from
`/apps/webapplications/NFA_Approval/Quality/backend/.env`, reset only the
internal roles in `nfa-quality-db`, and force-recreate only these Quality
services: `auth`, `rest`, `realtime`, `storage`, `meta`, `kong`, and `studio`.

Verify all of the following before continuing:

- a real TCP login as `supabase_admin` succeeds;
- `nfa-quality-meta` remains healthy;
- Studio can load schemas, tables, and users;
- unrelated `supabase-dev` and `supabase-prod` containers are untouched.

### 2. Check the actual Quality data before changing application code

Run read-only SQL inside `nfa-quality-db` to check:

- whether `public.role_permission` exists;
- the row count and role/screen combinations;
- authenticated and service-role grants;
- the enabled row-security policies;
- users, profiles, and user-role rows required by the selected login.

If the schema or data is absent, run the existing migration runner from the
Quality root. It reads the password from `backend/.env`; no password placeholder
is pasted. Confirm `9000_data_import.sql` is recorded as applied and that the
permission count is 28 afterward. Do not rerun the destructive import when its
rows are already present.

### 3. Identify the exact source of the 401

Compare SHA-256 fingerprints only—not secret values—for:

- `ANON_KEY` in `backend/.env`;
- `ANON_KEY` inside the running `nfa-quality-kong` container;
- the JWT key embedded in `frontend/dist/assets`.

Then call the same REST URL twice:

1. with the configured anon key, to verify Kong accepts it;
2. after a real sign-in, with both the anon key and returned user token, to
   verify authenticated access to `role_permission` returns the rows.

Only recreate Kong if its runtime fingerprint is stale. Only rebuild locally
if the fingerprint embedded in `dist` is stale; never regenerate valid keys
just to mask a deployment mismatch.

### 4. Correct the login-page permission timing

Update the local application so `role_permission` is fetched only after a
validated session exists, then refreshed when the signed-in user changes and
cleared on sign-out. The public login page will no longer make an authenticated-
only table request.

Keep the existing security boundary: do not grant anonymous access to
`role_permission`, and do not weaken its row-security policy.

Also keep the server-side login-ID lookup unchanged, but verify the Quality app
process receives `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from `frontend/.env`; restart only
`enfa-quality-app` with the refreshed environment.

### 5. Deploy using the existing prebuilt-release workflow

Build the corrected app locally in VS Code with the Quality `VITE_*` values,
upload the resulting `dist` folder to:

```text
/apps/webapplications/NFA_Approval/Quality/frontend/dist
```

Restart only `enfa-quality-app`; do not run npm, install packages, or build on
the Ubuntu server.

### 6. End-to-end verification

- Opening `/auth` makes no pre-login `role_permission` request.
- Login-ID resolution and password sign-in succeed.
- The first authenticated `role_permission` request returns `200` and 28 rows.
- The signed-in user’s role is loaded and the correct screens appear.
- Studio loads users and tables without the `supabase_admin` error.
- No Quality service remains unhealthy or restarting.

## Safety boundary

Only the Quality database roles, Quality containers, Quality app process, local
application source, and uploaded Quality `dist` are involved. No volume is
deleted, no data is cleared, no key is printed, and no dev/prod stack or other
application is changed.
