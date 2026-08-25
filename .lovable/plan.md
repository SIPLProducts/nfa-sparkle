# Make `npm run build` produce a `dist/` folder

Goal: one command, one output folder. After this change `npm run build` writes `dist/` containing `index.html`, hashed `assets/`, and everything from `public/` copied as-is (`favicon.png`, `manifest.webmanifest`, `templates/`, `robots.txt`, `sitemap.xml`, `sw.js`, `ramky-logo.png`) — exactly the listing in your screenshot. Copy that folder to the server, point nginx at it, done.

## What will change

1. **`vite.config.ts`**
   - Enable SPA mode so a static `index.html` shell is emitted instead of server-rendered HTML per request.
   - Set the client build output to `dist/`.
   - The React plugin, the `@/` → `./src` alias, Tailwind, and asset hashing are already provided by the shared Lovable Vite config, so they don't need to be re-added (adding them again breaks the build with duplicate plugins).

2. **`package.json`**
   - `npm run build` remains the single build command and now emits `dist/` instead of the `.output/` wrangler layout.

3. **`deploy/nginx/nfa-quality.conf`**
   - Port 8081 serves the copied folder: `root /opt/enfa/frontend; try_files $uri /index.html;`
   - `/_serverFn/*` and `/api/*` keep proxying to the Node service on `127.0.0.1:3000`.

4. **`deploy/README.md`**
   - Steps: `npm run build` → copy `dist/` to `/opt/enfa/frontend` → `nginx -s reload`.

## One thing to be aware of

`dist/` is only the frontend. SAP calls, login-protected data and `/api/public/*` are server code and can't run from static files, so the existing Node service keeps running as today — nginx just serves HTML/JS from `dist/` instead of asking Node for it. Nothing new to install.

## Verification

After the change, confirm `dist/index.html`, hashed files under `dist/assets/`, and all copied `public/` files exist, and that the built folder loads the app.
