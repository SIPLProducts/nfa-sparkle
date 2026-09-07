# Fix the 502 — start the eNFA app process on port 3000 (via PM2)

Confirmed from your output:

- `dist/` is correctly at `/apps/webapplications/NFA_Approval/Quality/frontend/dist/`, and
  `dist/server/index.mjs` (30 KB) exists — the build copy is complete.
- nginx is listening on 8081 and its config is correct.
- PM2 runs only `enfa-quality-middleware` (port 3005). **No process runs the SSR app on port
  3000**, so nginx gets no answer and shows 502.

## Fix — start the app with PM2 (same tool you already use)

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist

# make sure the env file exists (copy + fill once, if missing)
ls /apps/webapplications/NFA_Approval/Quality/frontend/.env

PORT=3000 HOST=127.0.0.1 pm2 start server/index.mjs --name enfa-quality-app
pm2 save
pm2 ls
```

If the app needs the env values at runtime (Supabase keys), load them explicitly:

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend
cp .env.example .env   # only if .env does not exist yet, then edit it with the real values
pm2 delete enfa-quality-app 2>/dev/null
cd dist
set -a && . ../.env && set +a
PORT=3000 HOST=127.0.0.1 pm2 start server/index.mjs --name enfa-quality-app \
  --update-env
pm2 save
```

## Verify

```bash
pm2 logs enfa-quality-app --lines 30     # no errors
sudo ss -tulpn | grep :3000              # now shows a LISTEN line
curl -I http://127.0.0.1:3000/           # HTTP/1.1 200
curl -I http://10.200.1.7:8081/          # HTTP/1.1 200
```

Then open http://10.200.1.7:8081 in the browser — the login page should load.

## If the PM2 process shows `errored` or restarts in a loop

Run `pm2 logs enfa-quality-app --err --lines 50` and paste the error — it names the real cause
(missing env, Node version, etc.).

## Optional repo change (small, helpful)

Add a PM2 config for the app next to the middleware one —
`deployment/Quality/middleware/ecosystem.config.cjs` already defines the middleware; I can add
`deployment/Quality/frontend/ecosystem.config.cjs` with the app entry so future starts are just
`pm2 start ecosystem.config.cjs`. Not required to fix the 502.

## Notes

- Nothing existing is touched: VMS middlewares and other apps keep running; we only ADD one PM2
  process named `enfa-quality-app`.
- No application source changes are needed for the 502 itself.
