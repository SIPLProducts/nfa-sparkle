# Fix unstyled /auth page and "Loading..." on /

## What is wrong

The deployed release serves the page HTML from the Node app, but the stylesheet and JavaScript files it asks for come back as "not found". Without the JavaScript the app never finishes starting, so `/` shows plain "Loading..." and `/auth` shows raw unstyled text.

Cause: in the server web-config, `/assets/` is forwarded to the Node app, which does not serve those files. They exist on disk in the release folder.

## What changes

1. **Serve the built files straight from disk (`deployment/nginx/enfa-quality.conf`)**
   - `location /assets/` no longer proxies to Node. It reads from the release folder on disk with `try_files $uri =404;`, long-lived caching, and correct file types.
   - Add matching direct-from-disk handling for the other built files (`favicon.png`, `ramky-logo.png`, `manifest.webmanifest`, icons) via the existing `try_files $uri @enfa_quality_node;` root rule, which already covers them.
   - Everything else (page HTML, `/_serverFn/`, `/api/`, backend `/v1/` paths) keeps the current behaviour.

2. **Logo**
   - `public/ramky-logo.png` already exists in the project and both the login page and the app header already point at `/ramky-logo.png`. No code change is needed; the plan only verifies this and that the file lands in the release folder.

3. **Release packaging check (`scripts/pack-dist.mjs`)**
   - It already writes the browser files to both `dist/` and `dist/public/` and fails the build if `assets/`, `favicon.png`, `manifest.webmanifest`, `ramky-logo.png` or the server bundle is missing. Keep as is; no change unless verification shows a gap.

4. **`deployment/README.md`**
   - Add a short "styles missing / stuck on Loading" section: how to confirm the file names in the served HTML match the files in `dist/assets`, and the exact redeploy sequence.

## Redeploy steps (documented in the README)

```text
1. On the build machine:  npm install  &&  npm run build
2. Copy the whole dist/ folder to the server release path
   /apps/webapplications/NFA_Approval/Quality/frontend/dist
   (use deployment/Quality/scripts/deploy-quality.sh — it swaps folders atomically
    and keeps dist.previous for rollback)
3. Link and reload the web config:
   ln -sf .../deployment/nginx/enfa-quality.conf /opt/Ramky_Applications/nginx/enfa-quality.conf
   nginx -t && systemctl reload nginx
4. Restart only the Quality app: pm2 restart enfa-quality-app
5. Verify: the stylesheet and script URLs in the page source return 200 on port 8081,
   /ramky-logo.png returns 200, and /auth renders styled.
```

## Scope guard

Only the Quality eNFA web config, the deployment README, and (if verification requires) the packaging script are touched. No other application, container, port, shared config or volume is modified.
