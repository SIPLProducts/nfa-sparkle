# Correct the Quality server deployment commands

## Confirmed problems

The command failed before deploying any new frontend files:

1. `/apps/webapplications/NFA_Approval/Quality/src` does not exist, but both the copy commands and `deploy-quality.sh` were told to use it.
2. This Ubuntu server cannot create IPv6 sockets, so every `listen [::]:...` line makes `nginx -t` fail. Nginx was therefore not reloaded.
3. Because the copy, Nginx reload, and build all failed, the server is still running the previous release; the login-page fix was never installed.

## Changes

1. **Make the Quality Nginx file compatible with this server**
   - Remove the IPv6 `listen [::]` entries from all four Quality-only server blocks.
   - Keep the IPv4 ports and all existing app, static-file, backend, Studio, and middleware routing unchanged.

2. **Make deployment work with the real source location**
   - Improve `deploy-quality.sh` preflight so it clearly distinguishes a source checkout from the published `frontend/dist` folder.
   - Continue supporting an explicit `SRC_DIR`, but stop presenting the nonexistent `Quality/src` path as though it is already present.
   - Do not rebuild or replace the live release until the source folder contains `package.json`, `deployment/`, and `scripts/pack-dist.mjs`.

3. **Replace the misleading runbook commands**
   - First locate the actual uploaded project folder by searching only under `/apps/webapplications/NFA_Approval`.
   - If no source checkout exists, document copying/cloning the complete latest project into `Quality/src`; copying only `dist` is not enough to update the deployment scripts and Nginx file.
   - Set `SRC`/`SRC_DIR` to the confirmed folder, copy the Quality files, test Nginx, deploy, and restart only `enfa-quality-app`.
   - Add direct checks for `/auth`, its exact hashed CSS/JS URLs, and `/ramky-logo.png`, all requiring HTTP 200.

## Server procedure after the updated files are available

```text
1. Locate the folder containing package.json and deployment/nginx/enfa-quality.conf.
2. If it is absent, upload/clone the complete latest project to Quality/src.
3. Copy the Nginx config and deployment script from that confirmed source folder.
4. Run nginx -t; reload only after it succeeds.
5. Run deploy-quality.sh with SRC_DIR set to the confirmed source folder.
6. Verify port 3000, port 8081, /auth, CSS, JavaScript, and the Ramky logo.
```

## Safety

Only the Quality Nginx file, Quality deployment helper, and deployment guide are changed. Existing applications, shared ports, non-Quality processes, containers, and volumes remain untouched.
