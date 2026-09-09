# Permanently fix the deployed login page

## Confirmed diagnosis

- The working local app includes its stylesheet and browser scripts through the TanStack Start document shell.
- The self-hosted package intentionally copies the same generated files into `dist/public`, which is where the packaged Node app expects public files.
- The current Nginx configuration bypasses Node for `/assets/` and resolves those URLs against its own filesystem root. The screenshot—unstyled `Loading…`—means the HTML arrived but the browser stylesheet/script did not.
- The remote server could not be reached from this workspace, so the exact active Nginx response cannot be inspected here. The deployment will therefore include mandatory checks that identify an inactive config, wrong release path, missing file, or permission error before reporting success.

## Changes

1. **Use one owner for the complete frontend**
   - Change the Quality `8081` Nginx server so page HTML, `/assets/*`, the Ramky logo, icons, favicon, and manifest all proxy to the same `enfa-quality-app` process on `127.0.0.1:3000`.
   - Keep only `/server/` blocked and retain the existing backend/API proxy rules, upload limits, timeouts, and Quality-only port isolation.
   - This removes the duplicated Nginx filesystem lookup that differs from the working application server.

2. **Keep the release self-contained**
   - Preserve `dist/server/index.mjs` and the complete browser output in `dist/public`.
   - Keep the root copy only for compatibility, but make `dist/public` the authoritative runtime asset location.
   - Keep `/ramky-logo.png` as the local login/header URL; the file already exists and is included in both package layouts.

3. **Make deployment fail on a broken page**
   - Extend the Quality deployment script to start/restart the app and request `/auth` directly from port `3000`.
   - Extract the generated stylesheet and module-script URLs from that exact HTML and require every URL, plus `/ramky-logo.png`, to return HTTP 200 with a non-HTML content type.
   - After Nginx reload, repeat the same checks through port `8081`.
   - If any check fails, print the failing URL and stop; do not claim the deployment succeeded.

4. **Provide one exact recovery sequence**
   - Update the deployment guide with commands to copy the updated Quality files, rebuild through `deploy-quality.sh`, verify the active include with `nginx -T`, reload Nginx, restart only `enfa-quality-app`, and run the automated checks.
   - Include browser cache clearing only after server checks pass, because cache is not the root fix.

## Verification

- Validate Nginx and shell syntax locally.
- Validate package assertions using a representative built release.
- Verify locally that `/auth` HTML references existing hashed CSS/JavaScript files and that the logo exists.
- On the Ubuntu server, success requires HTTP 200 for `/auth`, each referenced CSS/JavaScript file, and `/ramky-logo.png` through both ports `3000` and `8081`.
- Confirm `/auth` renders the styled Ramky login instead of plain text, and `/` redirects or loads after authentication rather than remaining on `Loading…`.

## Scope guard

Only the Quality Nginx configuration, self-host release/deployment checks, and deployment instructions will change. No other application, container, port, shared Nginx file, database, or volume will be touched.
