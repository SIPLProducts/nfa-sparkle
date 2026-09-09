# Fix Quality login page on the server — commands that match your server

## What the server output proves

1. There is no `Quality/src` folder. Your server only has the built releases at
   `Quality/frontend/dist` (and backup `dist_09-09-2026`). That is why both
   `cp` commands failed and why the deploy script said "Missing source checkout".
2. This server's kernel has IPv6 disabled, so the `listen [::]:8081;` lines in
   the nginx file make `nginx -t` fail with `socket() [::]:8081 failed (97)`.
   Nginx never reloaded, so the fixed config was never active.
3. Result: the server is still serving the old config and an old build. Nothing
   you copied from Lovable reached the running site.

## Changes in this repo

1. **Quality nginx file** (`deployment/nginx/enfa-quality.conf`)
   - Remove the four `listen [::]:...;` lines (IPv4 `listen 8081;` etc. stay).
   - Keep the static-file serving from the release folder exactly as it is now
     (`/assets/`, logo, icons, manifest served from disk with caching, Node as
     fallback), plus all existing app/backend/Studio/middleware proxying.

2. **A no-source-checkout path in `deployment/README.md`**
   - Your server has no source checkout, so the README gets a short section
     "Updating when the server only has dist/":
     - edit the nginx file already on the server (or copy just the one file
       from any machine that has the latest project),
     - no rebuild is needed for the nginx fix alone — the current `dist` already
       contains `assets/`, `ramky-logo.png`, `manifest.webmanifest` at both
       root and `public/`, so it matches the config,
     - run `nginx -t`, reload, then verify with curl.
   - Keep the full rebuild path (with a real source checkout) for the next
     application update.

3. **Deploy script preflight message**
   - `deploy-quality.sh` already stops when the source folder is missing; add a
     clearer message telling the operator to point `SRC_DIR` at a real checkout
     instead of the confusing "Missing source checkout" alone. (Only used on
     the rebuild path; not needed for the nginx-only fix.)

## Exact commands you will run on the server (no source folder needed)

```bash
cd /apps/webapplications/NFA_Approval/nginx
sudo sed -i '/listen \[::\]/d' enfa-quality.conf      # remove IPv6 lines
sudo nginx -t                                          # must say "syntax is ok"
sudo systemctl reload nginx
# verify the login page assets are served:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/auth
HTML=$(curl -s http://127.0.0.1:8081/auth)
for u in $(printf '%s' "$HTML" | grep -oE '/assets/[^"'"'"'<> ]+' | sort -u); do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081$u)"
done
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/ramky-logo.png
```

Then hard-refresh the browser (Ctrl+F5) and open `http://10.200.1.7:8081/auth`.

If any asset still returns 404, the README section documents the fallback:
copy the updated `enfa-quality.conf` from the latest project onto the server
and repeat `nginx -t && reload`.

## Safety

Only the Quality nginx file, deploy script message, and the deployment README
change. No application source code, no other nginx files, no other
applications, containers, ports, or volumes are touched.
