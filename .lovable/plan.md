# Local SAP Middleware + Multi-System SAP Configuration

Goal: ship a small Node.js middleware you run on your own network (exposed to the app via ngrok), and extend API Settings so multiple SAP systems can be registered and switched from the UI — no code changes when the SAP IP/host changes.

## 1. Middleware you run locally

A new `middleware/` folder in the project (not deployed with the app — you copy it to your machine and run it):

- `server.js` — Express service, default port 3005:
  - `GET /health` — liveness + version, used by "Test middleware".
  - `POST /sap/call` — the single generic proxy the app uses. Body: `{ system, method, path, query, headers, body, timeoutMs }`. It resolves the target SAP system from its own `.env`/`systems.json`, builds `http://<host>:<port><path>?sap-client=<client>`, adds Basic auth, forwards, and returns `{ status, ok, latencyMs, headers, body }`.
  - Every request must carry `x-proxy-secret`; mismatch returns 401.
  - Optional IP allow-list, request size cap, 30s timeout, redacted logging (never logs passwords).
- `systems.json` / `.env.example` — the local SAP landscape: `{ key, label, host, port, client, defaultUser, defaultPassword, useHttps }`. This is where the SAP host/IP, port, client (300) and service-user credentials live when you keep them on-premise.
- `README.md` — install (`npm i`), run (`npm start`), run as a Windows service / pm2, and the ngrok step: `ngrok http 3005`, then paste the `https://xxxx.ngrok-free.app` URL into API Settings → Middleware Configuration.

Sample call it will make for your ZENFA report endpoint:
`PUT http://10.200.1.2:8000/e-nfa/enfa_report//create?sap-client=300` with Basic auth and the filter payload (`plant_from`, `funct_from`, `nfano_from`, `dat_from/dat_to`, `usrid_from/to`, `r_proc/r_comp/r_reje`), returning the `REFFLD / PSPNR / NAME1 / FUNCT_TXT / SUBJECT / ROLE1..6 / APPR1..6 / STAT1..6 / STATUS_TXT` array.

## 2. Where connection details go in API Settings

Split today's single "SAP Connection" tab into a **SAP Systems** tab holding many systems:

- Table of systems with Add / Edit / Delete / Test and one marked **Active** (radio).
- Fields per system: Key (e.g. `DEV300`), Label, Environment (DEV/QUALITY/PROD), Protocol, Host or IP (`10.200.1.2`), Port (`8000`), SAP Client (`300`), Base path, Username, Password (write-only, stored in the existing secret table), Route via middleware (yes/no), Notes.
- The app composes the Base URL from protocol + host + port and always appends `sap-client`, so changing the IP is a field edit only.
- **Middleware Configuration** tab keeps: Connection Mode, Middleware URL (your ngrok URL), Port, Proxy Secret — plus a "Test middleware" button hitting `/health`.
- **APIs** tab: each endpoint gains a **SAP System** selector (default: "Use active system"), so an endpoint can be pinned to one system or follow the active one. The endpoint detail Credentials tab still allows per-endpoint overrides.

Switching environments = pick a different system as Active (or change its IP) in Settings; no redeploy.

## 3. App-side wiring

- Server functions resolve, in order: endpoint override → endpoint's system → active system, then either call SAP directly or POST to the middleware `/sap/call` with the proxy secret when Connection Mode is "Via Proxy Server".
- "Test connection" per system and "Test endpoint" both flow through the same resolver, so a test proves the real production path.

## Technical notes

- New table `sap_system` (key, label, environment, protocol, host, port, sap_client, base_path, username, route_via_middleware, is_active, notes) with admin-only RLS and grants; passwords go to the existing `sap_secret` service-role-only table under key `system:<id>`.
- `sap_endpoint` gains a nullable `system_id`; the existing `sap_connection` row is migrated into the first `sap_system` record so nothing is lost.
- `src/lib/sap-api.functions.ts` gets a shared `resolveTarget()` + `callSap()` helper used by all test/fetch paths; secrets never reach the browser.
- The `middleware/` folder is plain Node/Express with no Lovable dependencies and is excluded from the app build.

## Open point

The PDF lists a live user ID and password. I will not hardcode them — they go into the middleware `.env` on your machine (or the write-only password field in Settings). Please rotate that password since it was shared in a document.