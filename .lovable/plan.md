# Fix "Loading…" page — Node server can't find the static files (dist/public missing)

Current state (from your output):

- PM2 `enfa-quality-app` is online and listening on 127.0.0.1:3000.
- `curl -I http://10.200.1.7:8081/` returns **200** — nginx + app are connected. The 502 is gone.
- Remaining problem: the error log shows
  `ENOENT: ... open '/apps/webapplications/NFA_Approval/Quality/frontend/dist/public/manifest.webmanifest'`
  and the same for `favicon.png`. The Node server bundle expects its static files in a
  **`public/` subfolder inside dist/**, but the copied build has them at the dist root
  (`dist/assets`, `dist/icons`, `dist/favicon.png`, ...). The browser page hangs on "Loading…"
  because those files fail to load.

## Fix on the server — give the Node server the public/ folder it expects

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
mkdir -p public
cp -r assets icons favicon.ico favicon.png manifest.webmanifest public/
pm2 restart enfa-quality-app
```

(If your dist has other root-level files/folders besides `server/`, copy them into `public/` too.)

## Verify

```bash
pm2 logs enfa-quality-app --lines 20          # no more ENOENT lines
curl -I http://127.0.0.1:3000/manifest.webmanifest   # 200, not 500
curl -I http://10.200.1.7:8081/favicon.png           # 200
```

Then hard-refresh the browser (Ctrl+Shift+R) on http://10.200.1.7:8081 — the styled login page
should appear instead of the plain "Loading…" text.

## Repo change so this never happens again

`scripts/pack-dist.mjs` copies `.output/public` into `dist/` root but the Nitro node-server
bundle also resolves `../public` next to `dist/server/`. I will update `pack-dist.mjs` to ALSO
write the static files into `dist/public/` (so both nginx `root dist/` and the Node server's own
static handler find them). That way every future Windows build you copy over just works —
no manual mkdir step.

- Files to edit: `scripts/pack-dist.mjs` (add the extra copy step), plus a one-line note in
  `deployment/README.md`.
- After the edit, rebuild once on Windows (`npm run build`) and copy the new `dist/` over — it
  will already contain `public/`.

## Notes

- Nothing existing on the server is touched: no other apps, ports, or nginx files.
- The duplicated static files cost a few MB of disk only; nginx keeps serving from `dist/` root
  as before.
