# Fix the 502 on http://10.200.1.7:8081 — the app's Node server is not running

Your `ss` output proves the diagnosis:

- Port **8081** is listening (nginx) — so `enfa-quality.conf` IS loaded and correct.
- Port **3000** is missing from the output — nothing is running there.

nginx forwards `/` to `127.0.0.1:3000`. Nothing answers, so nginx returns 502. The nginx file is
fine; the application itself was never started.

## Step 1 — Put the build on the server

The build folder from Windows (`D:\VPCL_Ramky\nfa-sparkle\dist\`) must be copied to:

```
/apps/webapplications/NFA_Approval/Quality/frontend/dist/
```

Check it arrived:

```bash
ls -la /apps/webapplications/NFA_Approval/Quality/frontend/dist/
ls -la /apps/webapplications/NFA_Approval/Quality/frontend/dist/server/index.mjs
```

If `server/index.mjs` is missing, the copy is incomplete — recopy the whole `dist` folder.

## Step 2 — Start the app by hand first (quick proof)

```bash
cd /apps/webapplications/NFA_Approval/Quality/frontend/dist
PORT=3000 HOST=127.0.0.1 node server/index.mjs
```

Leave it running, and in a second terminal:

```bash
curl -I http://127.0.0.1:3000/      # expect HTTP/1.1 200
curl -I http://10.200.1.7:8081/     # expect HTTP/1.1 200
```

If step 2 prints an error instead of starting, paste that error — it names the real problem
(missing env values, wrong Node version, etc.).

## Step 3 — Make it permanent with systemd

Create `/etc/systemd/system/enfa-quality-app.service`:

```ini
[Unit]
Description=eNFA Quality app (Node SSR)
After=network.target

[Service]
Type=simple
WorkingDirectory=/apps/webapplications/NFA_Approval/Quality/frontend/dist
EnvironmentFile=/apps/webapplications/NFA_Approval/Quality/frontend/.env
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now enfa-quality-app
sudo systemctl status enfa-quality-app --no-pager
sudo ss -tulpn | grep :3000     # now shows a listener
```

The `.env` file must exist first — copy it from
`Quality/frontend/.env.example` and fill in the Quality backend URL and keys.

## Step 4 — Confirm

Open http://10.200.1.7:8081 in the browser; the login page should load.

## Notes

- This adds one new systemd unit named `enfa-quality-app`; no existing service, container, port,
  or nginx file is touched.
- No repository code changes are needed — this is server setup only.
