# Fix PM2 startup path for the packaged server

## Confirmed cause

The shell is currently inside:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist
```

From that directory, `pm2 start dist/server/index.mjs` expands to:

```text
.../frontend/dist/dist/server/index.mjs
```

That path does not exist. The generated server is expected at `.../frontend/dist/server/index.mjs`.

## Immediate server recovery

1. Confirm the packaged server exists:

```bash
test -f /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist/server/index.mjs && echo "Server bundle OK"
```

2. Start it using an absolute path, so the command works from any directory:

```bash
pm2 start /opt/Ramky_Applications/NFA-Approval/Quality/frontend/dist/server/index.mjs \
  --name NFA-Portal-App \
  --cwd /opt/Ramky_Applications/NFA-Approval/Quality/frontend \
  --update-env
pm2 save
```

3. Verify the process and local application port:

```bash
pm2 status NFA-Portal-App
pm2 logs NFA-Portal-App --lines 50
curl -I http://127.0.0.1:3000/
```

The `restart` failure is expected because `NFA-Portal-App` has not been created in PM2 yet. After the first successful `pm2 start`, future deployments can use:

```bash
pm2 restart NFA-Portal-App --update-env
```

## Repository update

- Change PM2 examples in the deployment guide to use the absolute server entry and explicit working directory.
- Add a PM2-first-start versus later-restart section to prevent repeating the `dist/dist` path issue.
- Keep `dist/server/index.mjs` as the stable generated entry point; no build-layout change is required.
