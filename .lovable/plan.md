# Fix the deployed login page so it loads styled and works

## What is wrong

- The browser receives the `/auth` HTML, but the CSS and JavaScript files it asks for are returning 404.
- Without CSS/JS, `/auth` is plain text and `/` stays stuck on `Loading…`.
- The root cause is the Nginx config on the server: it tries to serve `/assets/` straight from disk, but the Node app is the one that knows where those hashed files really are.
- I cannot run commands on your server from here, so I will change the repository files and give you exact copy-and-paste commands to run on the Ubuntu server.

## What I will change in the repository

1. **Nginx config (`deployment/nginx/enfa-quality.conf`)**
   - Make Nginx proxy `/assets/`, the logo, icons, favicon, and manifest to the Node app on `127.0.0.1:3000`, just like it does for HTML.
   - Keep only `/server/` blocked and keep all backend/API rules unchanged.

2. **Deploy script (`deployment/Quality/scripts/deploy-quality.sh`)**
   - After building, automatically check that `/auth` and every CSS/JS file it references return HTTP 200.
   - If any check fails, the script stops and tells you exactly which URL failed.

3. **Deployment guide (`deployment/README.md`)**
   - Add the exact commands to copy the files, rebuild, reload Nginx, and verify.

## Exact steps you will run on the Ubuntu server

```text
1. Copy the updated files from your source checkout to the server paths:
   cp <your-git-checkout>/deployment/nginx/enfa-quality.conf \
      /apps/webapplications/NFA_Approval/nginx/enfa-quality.conf
   cp <your-git-checkout>/deployment/Quality/scripts/deploy-quality.sh \
      /apps/webapplications/NFA_Approval/Quality/scripts/deploy-quality.sh
   chmod +x /apps/webapplications/NFA_Approval/Quality/scripts/deploy-quality.sh

2. Rebuild and deploy the Quality frontend:
   cd /apps/webapplications/NFA_Approval/Quality
   PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/deploy-quality.sh

3. The script will automatically verify the login page assets on port 3000 and 8081.
   If it says "Done", the page is fixed.

4. Hard-refresh the browser (Ctrl+F5) and open http://10.200.1.7:8081/auth.
```

## What success looks like

- `http://10.200.1.7:8081/auth` shows the styled Ramky login page, not plain text.
- `http://10.200.1.7:8081/` redirects to `/auth` when not signed in, instead of staying on `Loading…`.

## Scope guard

Only the Quality Nginx config, deploy script, and README change. No other app, container, port, shared Nginx file, database, or volume is touched.
