# Build output on the Quality server

## What `npm run build` produces

`npm run build` = `vite build` + `node scripts/pack-dist.mjs`.

Because `LOVABLE_SANDBOX` is not set on your Ubuntu server, the self-hosted branch of `vite.config.ts` activates:

- SPA shell prerender is on, so a real `dist/index.html` is emitted.
- Nitro uses the `node-server` preset, so a runnable Node bundle is emitted.

Raw Vite output, before packing:

```text
dist/client/        static frontend (index.html, assets/, favicon, etc.)
.output/server/     Node server bundle (index.mjs + chunks + node_modules)
.output/public/     static copy used by the Node server
```

`pack-dist.mjs` then flattens things for nginx:

```text
dist/index.html
dist/assets/...            hashed JS/CSS
dist/<static files>        images, favicon, robots, etc.
.output/server/index.mjs   app server entry (PM2 target)
```

It also moves any legacy `dist/server` into `.output/server` (only when that folder does not already exist) and deletes `nitro.json` / `package.json` / `package-lock.json` from `dist/` so build metadata is never served publicly.

## Deploy sequence on the server

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
npm ci
npm run build          # generates dist/ and .output/server/index.mjs
pm2 restart NFA-Portal-App || pm2 start .output/server/index.mjs --name NFA-Portal-App
pm2 save
```

Verify before restarting nginx:

```bash
ls -la dist/index.html
ls -la .output/server/index.mjs
curl -I http://127.0.0.1:3000/
```

## How nginx uses the two outputs

- `/` and all static assets -> `root .../frontend/dist;` with `try_files $uri /index.html;`
- `/_serverFn/` and `/api/public/` -> `proxy_pass http://127.0.0.1:3000;`

This is why the app server must be running: the static `dist/` alone cannot answer server-function calls, which is what caused the nginx 405 on login.

## Notes

- `.output/server` is self-contained; do not run `npm ci --omit=dev` in a way that removes it, and do not delete `.output` between build and start.
- Never copy `dist/` from the Lovable sandbox — sandbox builds use the platform layout and will not contain `.output/server/index.mjs`.
- Environment variables (`VITE_*`) are baked into `dist/` at build time, so rebuild on the server whenever they change.
