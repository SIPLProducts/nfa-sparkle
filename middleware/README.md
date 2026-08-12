# eNFA ↔ SAP Middleware (run on your network)

A tiny Express service that sits between the cloud eNFA portal and your on-premise
SAP systems. The portal never talks to SAP directly — it posts to this middleware,
which forwards the call over your LAN and returns the response.

```
eNFA portal (cloud)  --https-->  ngrok  -->  middleware :3005  --LAN-->  SAP 10.200.1.2:8000
```

## 1. Install and run

```bash
cd middleware
npm install
cp .env.example .env                 # set PROXY_SECRET to a long random string
cp systems.example.json systems.json # add your SAP hosts / clients / users
npm start
```

Check it: `curl http://localhost:3005/health`

Keep it running permanently with pm2 (Linux) or nssm (Windows service):

```bash
npm i -g pm2 && pm2 start server.js --name enfa-sap-middleware && pm2 save
```

## 2. Expose it with ngrok

```bash
ngrok http 3005
```

Copy the `https://xxxx.ngrok-free.app` URL. A reserved ngrok domain is recommended
so the URL survives restarts.

## 3. Configure the portal

In the app: **Admin → SAP API Settings**

- **Middleware Configuration** tab
  - Connection Mode: `Via Proxy Server`
  - Node.js Middleware URL: your ngrok URL (e.g. `https://xxxx.ngrok-free.app`)
  - Middleware Port: `3005`
  - Proxy Secret: the same value as `PROXY_SECRET` in `.env`
  - Press **Test middleware** — it calls `GET /health`.
- **SAP Systems** tab — add one row per SAP system (Host/IP, Port, Client, Username,
  Password, System Key) and mark one **Active**. Changing environment later is just
  editing the IP or switching which system is Active — no code change, no redeploy.
- **APIs** tab — each endpoint can use the active system or be pinned to a specific one.

## 4. Endpoints exposed by this middleware

| Method | Path        | Auth               | Purpose                                  |
| ------ | ----------- | ------------------ | ---------------------------------------- |
| GET    | `/health`   | none               | liveness + configured systems            |
| GET    | `/systems`  | `x-proxy-secret`   | list of local systems (passwords masked) |
| POST   | `/sap/call` | `x-proxy-secret`   | generic SAP pass-through                 |

### `POST /sap/call`

```jsonc
{
  "system": "DEV300",              // optional, key from systems.json
  "baseUrl": "http://10.200.1.2:8000", // optional, sent by the portal, wins over system host
  "method": "PUT",
  "path": "/e-nfa/enfa_report//create",
  "query": { "sap-client": "300" },
  "headers": { "Content-Type": "application/json" },
  "body": { "plant_from": "9000", "dat_from": "2026-08-01", "r_proc": "X" },
  "auth": { "username": "sipl_qm", "password": "..." }, // optional override
  "timeoutMs": 30000
}
```

Response:

```jsonc
{ "ok": true, "status": 200, "latencyMs": 412, "contentType": "application/json", "body": [ /* SAP payload */ ] }
```

### ZENFA report example

```bash
curl -X POST http://localhost:3005/sap/call \
  -H "content-type: application/json" \
  -H "x-proxy-secret: $PROXY_SECRET" \
  -d '{
    "system":"DEV300",
    "method":"PUT",
    "path":"/e-nfa/enfa_report//create",
    "body":{"plant_from":"9000","dat_from":"2026-08-01","dat_to":"2026-08-31","r_proc":"X"}
  }'
```

Returns the ZENFA rows (`REFFLD`, `PSPNR`, `NAME1`, `FUNCT_TXT`, `EXTR_TXT`, `SUBJECT`,
`INIT_NAME`, `BEGDA`, `ROLE1..6`, `APPR1..6`, `STAT1..6`, `STATUS_TXT`).

## Security notes

- Every proxied call requires the `x-proxy-secret` header.
- Optional `ALLOW_IPS` restricts callers by source IP.
- Passwords are never logged and `/systems` masks them.
- `.env` and `systems.json` are git-ignored — keep credentials on your machine only.
- Rotate the SAP service-user password if it has ever been shared in a document or chat.