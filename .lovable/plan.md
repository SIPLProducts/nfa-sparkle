# Fix the Quality login page first

The screenshot confirms `/auth` is rendering the correct login-page HTML, but the browser is not loading the generated CSS and JavaScript. The `/` page remains on `Loading…` for the same reason: React never starts in the browser. The missing logo is a second asset issue because it currently uses a Lovable-hosted asset path that is not automatically available on the self-hosted server.

Backend container recovery will wait until the login screen is visually and functionally loading.

## 1. Fix the confirmed empty `dist/public` folder

The PM2 error is explicit:

```text
ENOENT: ... /dist/public/manifest.webmanifest
```

Although `public/` exists, its contents have not been confirmed. Run exactly:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist

rm -rf public
mkdir -p public
cp -a assets public/
cp -a icons public/
cp -a favicon.ico favicon.png manifest.webmanifest public/

find public -maxdepth 2 -type f | head -20
test -f public/manifest.webmanifest && echo "manifest OK"
test -f public/favicon.png && echo "favicon OK"
test -d public/assets && echo "assets OK"
```

All three `OK` lines must appear. Then restart only this app:

```bash
PORT=3000 HOST=127.0.0.1 pm2 restart enfa-quality-app --update-env
pm2 logs enfa-quality-app --lines 30 --nostream
```

The new log output must not contain `ENOENT` for `dist/public`.

## 2. Clear old logs and test the exact CSS and JavaScript files referenced by `/auth`

The latest output confirms the copy succeeded (`manifest OK`, `favicon OK`, `assets OK`). The ENOENT lines shown afterward are historical entries still retained in PM2's error log, not proof of a new failure. Clear only this app's logs, make a fresh request, and check fresh output:

```bash
pm2 flush enfa-quality-app
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/auth
pm2 logs enfa-quality-app --lines 30 --nostream
```

There should be no new `ENOENT` entry.

The previous `grep` reported “binary file matches” because the streamed HTML contains encoded bytes. Extract real URLs with text mode:

```bash
curl -sS http://127.0.0.1:3000/auth -o /tmp/enfa-auth.html
grep -aohE '(src|href)="[^"]+"' /tmp/enfa-auth.html \
  | sed -E 's/^(src|href)="//; s/"$//' \
  | grep '^/assets/' \
  | sort -u \
  | tee /tmp/enfa-assets.txt
```

Test every real URL automatically — do **not** type `PASTE_ASSET_PATH_HERE` literally (its 404 was expected because it was only an instruction placeholder):

```bash
while IFS= read -r asset; do
  printf '\nNODE %s\n' "$asset"
  curl -sS -I "http://127.0.0.1:3000${asset}" | head -5
  printf 'NGINX %s\n' "$asset"
  curl -sS -I "http://127.0.0.1:8081${asset}" | head -5
done < /tmp/enfa-assets.txt
```

Both must return `200`. CSS must return `Content-Type: text/css`; JavaScript must return a JavaScript content type. If a referenced filename is absent from both `dist/assets` and `dist/public/assets`, the deployed server and assets came from different builds and must be replaced together.

If `/tmp/enfa-assets.txt` is empty, inspect the HTML safely with:

```bash
tr -d '\000' < /tmp/enfa-auth.html | grep -aoE '/assets/[^"[:space:]<>]+' | sort -u
```

## 3. If asset filenames do not match, deploy one clean release

On Windows, set the Quality environment before building, then run:

```powershell
npm install
npm run build
```

On the server, preserve the current release but do not merge the new files into it:

```bash
pm2 stop enfa-quality-app
cd /apps/webapplications/NFA_Approval/Quality/frontend
mv dist "dist.backup-$(date +%Y%m%d-%H%M%S)"
mkdir dist
```

Copy the complete newly generated `dist` into that empty folder. Then repeat Step 1 and restart PM2. This prevents old hashed filenames from being mixed with the new server bundle.

## 4. Reload nginx and verify the login page

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://127.0.0.1:3000/auth
curl -I http://127.0.0.1:8081/auth
```

Hard-refresh `http://10.200.1.7:8081/auth` with `Ctrl+F5`. The page must display the two-column corporate layout rather than plain text. `/` should then redirect/render instead of remaining at `Loading…`.

## 5. Make the logo self-hosted

The login source imports `ramky-logo.png.asset.json`, whose `/__l5e/assets-v1/...` path is provided by Lovable hosting and is not part of the Ubuntu `dist` folder. Package the actual Ramky logo as a local public build asset and update the login page to reference that packaged URL. This removes the broken image without changing the login flow or styling.

## Repository changes after approval

1. Update `scripts/pack-dist.mjs` to always create `dist/public` with the complete static output during `npm run build`.
2. Package the Ramky logo for self-hosted builds and replace the Lovable-only logo path on the login screen.
3. Update the Quality deployment script and guide to replace releases atomically, verify generated CSS/JS files, and restart PM2 with the correct working directory.
4. Validate that the build contains matching root/public assets and the runnable server bundle.

## Login-page success criteria

- No `dist/public` ENOENT errors in PM2.
- `/auth` CSS and JavaScript requests return `200` with correct content types.
- The styled corporate login page and Ramky logo display correctly.
- `/` no longer remains at `Loading…`.

After this passes, handle the Quality backend containers and database-role authentication as a separate second step.