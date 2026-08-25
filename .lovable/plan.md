# Make `npm run build` produce a `dist/` folder

Right now `npm run build` writes `.output/` in a Cloudflare/wrangler layout. After this change, `npm run build` writes a single `dist/` folder containing `index.html`, `assets/`, `favicon.png`, `manifest.webmanifest`, `sw.js`, `robots.txt`, etc. — exactly the folder listing you shared. You copy that folder to the server and point nginx at it. No second script, no extra output folder.

## What will change

1. **`vite.config.ts`**
   - Turn on SPA mode so a static `index.html` shell is generated instead of per-request server HTML.
   - Set the build output directory to `dist/`, so client JS/CSS land in `dist/assets/` and everything in `public/` is copied to the root of `dist/`.

2. **`package.json`**
   - `npm run build` stays the only build command; it now produces `dist/`. `.output/` is no longer created.

3. **nginx (`deploy/nginx/nfa-quality.conf`)**
   - Port 8081 serves the copied `dist/` folder directly: `root /opt/enfa/frontend; try_files $uri /index.html;`
   - The dynamic paths the app calls (`/_serverFn/*`, `/api/*`) keep proxying to the Node process on `127.0.0.1:3000`, since SAP calls and admin APIs run there.

4. **Docs**
   - `deploy/README.md` updated: build → copy `dist/` to `/opt/enfa/frontend` → reload nginx.

## One thing to be aware of

`dist/` is only the frontend. The SAP integration, login-protected data and `/api/public/*` endpoints are server code — they cannot run from static files. So the existing Node service (`enfa-app`) stays running exactly as it does today; nginx just serves the HTML/JS from `dist/` instead of asking Node for it. Nothing new to install.

## Technical details

- `vite.config.ts`: enable `tanstackStart.spa`, and override the client build `outDir` to `dist`.
- Verify after the change that `dist/index.html`, `dist/assets/*`, and the copied `public/` files exist and the app loads from the built folder.
