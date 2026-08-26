# One self-contained `dist/` release folder

Today a build produces two separate places on disk:

- `dist/` — static browser assets (JS/CSS/images), served by nginx
- `.output/server/index.mjs` — the Node app server (login resolution, server functions, API routes), run by PM2

That is why the left pane shows both `dist` and `.output`. Both are regenerated from scratch on every `npm run build`, so file names inside them change (hashed asset names), but the two top-level folder names stay the same. Copying only `dist` to the server is what breaks login — the server half is missing.

## Goal

Make `dist/` the single deployable artifact: one folder to copy, one folder to back up, one folder to roll back.

New layout after `npm run build`:

```text
dist/
  index-*.js, assets/, favicon…   <- static files nginx serves
  server/
    index.mjs                     <- Node app server (PM2 entry)
    chunks/, _ssr/ …
```

`.output/` becomes a build-only scratch folder that no longer needs to be deployed.

## Changes

1. `scripts/pack-dist.mjs`
   - Copy `.output/public` into `dist/` (unchanged behaviour).
   - Additionally copy `.output/server` into `dist/server`.
   - Nginx must not serve the server bundle, so the config below never falls through to it.
   - Keep dropping build metadata (`nitro.json`, stray `package.json`).
2. `deploy/nginx/nfa-quality.conf` — keep static `try_files` from `dist/`, but explicitly `deny`/`return 404` for `/server/` so the Node bundle is never downloadable; app routes still proxy to the Node server on port 3000.
3. `deploy/systemd/enfa-app.service`, `deploy/scripts/deploy-quality.sh`, `deploy/README.md` — change the entry point from `.output/server/index.mjs` to `dist/server/index.mjs` and update the post-build verification to check `dist/server/index.mjs`.

## Deploy / backup flow after this change

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/frontend
npm ci && npm run build
test -f dist/server/index.mjs && echo OK

# backup previous release
mv dist_prev dist_old 2>/dev/null; cp -r dist dist_$(date +%F)

pm2 restart NFA-Portal-App || pm2 start dist/server/index.mjs --name NFA-Portal-App
pm2 save
```

Rollback = point PM2 at an older `dist_<date>/server/index.mjs` and switch the nginx root to that folder.

## Notes

- Contents of `dist/` change on every build (hashed filenames); the folder name and `dist/server/index.mjs` path stay stable, so PM2/nginx/systemd config never needs editing again.
- `.env` stays outside `dist/` and is read by the Node process at runtime — do not bake it into the release folder.
