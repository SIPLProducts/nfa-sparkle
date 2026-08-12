# Deliver the SAP middleware as a downloadable file

You want the middleware handed to you here in chat as a download, rather than cloning the repo or copying files out of the editor.

## What I'll produce

A single ZIP, `enfa-sap-middleware.zip`, posted in chat with a download button. It contains the exact `middleware/` folder that already exists in the project:

```text
enfa-sap-middleware/
  server.js              Express proxy: /health, /systems, /sap/call
  package.json           dependencies + npm start
  env.example.txt        rename to .env  - PROXY_SECRET, PORT, IP allow-list
  systems.example.json   rename to systems.json - your SAP hosts/clients/users
  README.md              install, ngrok, portal setup, curl examples
```

Sample files ship with plain visible names (`env.example.txt`) so nothing is hidden on Windows; the README states exactly what to rename.

## What you do after downloading

1. Unzip, then `npm install`
2. Rename `env.example.txt` to `.env` and set a long random `PROXY_SECRET`
3. Rename `systems.example.json` to `systems.json` and fill in SAP host/IP, port, client, username, password
4. `npm start`, then check `http://localhost:3005/health`
5. `ngrok http 3005` and copy the https URL
6. In the app: Admin > SAP API Settings > Middleware Configuration - paste the ngrok URL, port 3005, the same proxy secret, then press Test middleware

## Notes

- No application code changes are required; this is purely packaging the existing folder for download.
- Please rotate the SAP password shared earlier in the PDF before putting it into `systems.json`.