# Middleware .env — why there are no SAP settings in it

Your `.env` is correct as-is. The middleware `.env` only holds how the proxy itself runs:

- `PORT` — the port Node listens on (3005; nginx publishes it as 3004)
- `PROXY_SECRET` — shared secret; the same value goes in Admin → SAP API Settings → Middleware Configuration
- `TIMEOUT_MS` — upstream SAP timeout (180000 for slow attachment calls)
- `ALLOW_IPS` — optional IP allow-list (empty = allow all)

SAP host / port / client / user / password are deliberately **not** in `.env`. They live in `systems.json` next to `server.js`, because the middleware supports several SAP systems at once and `.env` can only hold one set of values.

## What to add on the server

Create `/opt/Ramky_Applications/NFA-Approval/Quality/middleware/systems.json`:

```json
[
  {
    "key": "QAS300",
    "label": "SAP Quality (client 300)",
    "host": "10.200.1.2",
    "port": 8000,
    "client": "300",
    "useHttps": false,
    "defaultUser": "<sap service user>",
    "defaultPassword": "<sap password>",
    "default": true
  }
]
```

Then `chmod 600 systems.json` and restart: `systemctl restart enfa-middleware`.

Verify: `curl -s http://127.0.0.1:3005/health` should list the system under `systems`.

## One important note

The app already sends `baseUrl` and `auth` on every `/sap/call` from what you saved in Admin → SAP API Settings → SAP Systems. So if those fields are filled in the portal, `systems.json` is only a fallback — but keep it present and correct so `/health` and any call without an explicit target still resolve.

## Change I propose in the repo

Only documentation: update `deploy/env/middleware.env.quality.example` and `middleware/README.md` with a short "SAP credentials live in systems.json, not .env" note plus the quality-server path, so this is not confusing next time. No application or middleware code changes.

## Also worth doing

`PROXY_SECRET=123456` is weak and the middleware is reachable through nginx on port 3004. Replace it with `openssl rand -hex 32` and paste the same value into the portal's Middleware Configuration.
