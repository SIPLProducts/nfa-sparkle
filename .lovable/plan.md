# Build a deployable `dist/` frontend folder

Today `npm run build` emits `.output/` in a Cloudflare/wrangler layout, which is awkward to copy onto the Ubuntu server. The goal: `npm run build` produces a plain `dist/` folder containing `index.html`, `assets/`, `favicon.png`, `manifest.webmanifest`, `sw.js` etc. — exactly like the folder listing you shared — so you can copy it into your `frontend` folder and let nginx serve it.

## What will change

1. **SPA/static client output**
   - Enable TanStack Start's SPA mode so a static `index.html` shell is emitted instead of per-request SSR HTML.
   - Point the client build output at `dist/` (root-level), so `dist/index.html` + `dist/assets/*` are produced, with `public/` files copied alongside.

2. **`package.json` scripts**
   - `npm run build` → produces both the `dist/` frontend and the Node server bundle.
   - `npm run build:frontend` → frontend-only, writes `dist/`.

3. **Deployment wiring**
   - `deploy/nginx/nfa-quality.conf`: the 8081 vhost serves `root /opt/enfa/frontend;` with `try_files $uri /index.html;` for static assets, and still proxies the dynamic paths (`/_serverFn/*`, `/api/*`) to the Node process on `127.0.0.1:3000`.
   - `deploy/scripts/deploy-quality.sh`: after build, rsync `dist/` into the frontend folder, then restart the app + middleware as today.
   - `deploy/README.md`: updated steps and the new folder layout.

## Important note on the backend half

The app's SAP calls, login-gated data and admin APIs run as server functions and `/api/public/*` routes. A `dist/` folder alone cannot serve those — the Node service (`.output/server/index.mjs`, systemd `enfa-app`) must keep running, and nginx forwards `/_serverFn` and `/api` to it. So the deployment becomes:

```text
nginx :8081
  ├── /            → static files from /opt/enfa/frontend  (dist/)
  ├── /_serverFn/* → 127.0.0.1:3000  (Node)
  └── /api/*       → 127.0.0.1:3000  (Node)
```

If you'd rather nginx serve everything with no Node process, the SAP integration would have to move entirely into the standalone middleware — say the word and I'll plan that separately.

## Technical details

- `vite.config.ts`: add `tanstackStart: { spa: { enabled: true }, ... }` and a `vite: { build: { outDir: 'dist' } }` override for the client environment; keep the existing `server: { entry: "server" }` for the Node bundle.
- Verify after the change that `dist/index.html`, `dist/assets/`, and the copied `public/` files all exist, and that the Node bundle still builds.
