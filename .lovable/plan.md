# Fix 502 on http://10.200.1.7:8081 — include the config + start the Node app

Two confirmed causes from your screenshots:

1. **Your nginx.conf does not load `enfa-quality.conf`.** The active include is
   `include /opt/Ramky_Applications/nginx/*.conf;` — `sites-enabled` is commented out and
   `/apps/webapplications/NFA_Approval/nginx/` is not included anywhere. So the 8081 server
   block you tested is only live if something else already proxies 8081, OR nginx is serving a
   stale config. Either way the file must be linked into an included directory.
2. **502 Bad Gateway means nginx reached the block but nothing listens on 127.0.0.1:3000** —
   the Node SSR server (`dist/server/index.mjs`) is not running yet.

## Fix (run on the server)

1. Include the config without touching existing applications:
   ```bash
   sudo ln -sf /apps/webapplications/NFA_Approval/nginx/enfa-quality.conf \
       /opt/Ramky_Applications/nginx/enfa-quality.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
   (Symlink into the already-included folder — do NOT edit nginx.conf or other apps' files.
   If you prefer your own folder instead, add ONE line to nginx.conf:
   `include /apps/webapplications/NFA_Approval/nginx/*.conf;`)

2. Copy the Windows build output to the server:
   ```bash
   mkdir -p /apps/webapplications/NFA_Approval/Quality/frontend/dist
   # copy contents of D:\VPCL_Ramky\nfa-sparkle\dist\* into that folder
   ```

3. Start the Node SSR app on port 3000 (creates the systemd service from the deployment kit,
   or quick manual test first):
   ```bash
   cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
   PORT=3000 HOST=127.0.0.1 node server/index.mjs &
   curl -I http://127.0.0.1:3000/    # expect HTTP 200
   ```
   Then set up the systemd unit for a permanent service (kit: `deployment/README.md`).

4. Verify:
   ```bash
   sudo ss -tulpn | grep -E ':(3000|8081)'
   curl -I http://10.200.1.7:8081/
   ```
   Then open http://10.200.1.7:8081 in the browser.

## Notes

- If port 8081 is already used by another app (check `sudo ss -tulpn | grep 8081` BEFORE
  reloading), tell me the owner — we'll pick a new port rather than disturb it.
- No repository code changes needed; this is server configuration only.
