# Confirm nginx config + install the built dist on the Quality server

Your screenshot shows a correct build output: `dist/` contains `assets/`, `icons/`, `server/` (the Node SSR bundle), favicons, and `manifest.webmanifest`. Your edited nginx file is also correct — the changes you made are safe:

- `server_name 10.200.1.7;` on the 8081 block: fine (IP-based access).
- Commented-out `listen [::]:...` lines: fine when the server has no IPv6.
- Everything else (upstreams, proxy rules, timeouts, body limits) matches the deployment kit.

## Steps to run on the server (10.200.1.7)

1. Publish the build output:
   ```bash
   mkdir -p /apps/webapplications/NFA_Approval/Quality/frontend/dist
   rm -rf /apps/webapplications/NFA_Approval/Quality/frontend/dist/*
   # copy the whole contents of D:\VPCL_Ramky\nfa-sparkle\dist\* into that folder
   ```
2. Install the nginx config (only if not already done):
   ```bash
   sudo cp /apps/webapplications/NFA_Approval/nginx/enfa-quality.conf /etc/nginx/sites-available/enfa-quality.conf
   sudo ln -sf /etc/nginx/sites-available/enfa-quality.conf /etc/nginx/sites-enabled/enfa-quality.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. Start the Node SSR server from `dist/server/index.mjs` (systemd service `enfa-quality-app`, port 3000) so the `@enfa_quality_node` proxy target answers.
4. Smoke tests:
   ```bash
   curl -I http://10.200.1.7:8081/          # app (expect 200)
   curl -I http://10.200.1.7:8001/auth/v1/health   # Kong
   curl -I http://127.0.0.1:3000/           # Node direct
   ```
5. Open `http://10.200.1.7:8081` in a browser and log in.

## One caveat to watch

`location ~ ^/(_serverFn|api)/` proxies server functions to Node, while static files under `dist/` are served by nginx directly. If the app ever 404s on a client route after a hard refresh, the fix is in this block (`try_files $uri @enfa_quality_node;` already handles it — no change needed unless observed).

## No code changes

This turn is verification only; no repository files will be edited.
