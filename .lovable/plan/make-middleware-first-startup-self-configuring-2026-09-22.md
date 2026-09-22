# Make middleware first startup self-configuring

## Confirmed cause

The screenshot shows only `.env.example` inside the middleware folder. The middleware correctly searches for `D:\ENFA\nfa-sparkle\middleware\.env`, but that real configuration file has not been created, so startup stops before port 3008 opens.

## Implementation

1. **Create missing local configuration automatically**
   - When `server.js` starts and `.env` is absent, create it beside `server.js` using the non-secret settings from `.env.example`.
   - Generate a strong random `PROXY_SECRET` locally using Node’s cryptographic generator instead of copying the placeholder or using `123456`.
   - Never overwrite an existing `.env` or existing secret.
   - Keep `.env` excluded from Git.

2. **Make the generated secret usable**
   - On first startup, clearly display the generated Proxy Secret once with the exact portal location where the same value must be entered.
   - On later startups, load the saved `.env` normally without displaying the secret.
   - Preserve the existing clear error for an unreadable or malformed configuration file.

3. **Complete first-run setup**
   - If `systems.json` is missing, copy `systems.example.json` to `systems.json` without overwriting existing SAP settings.
   - Report that the SAP host/user/password must be reviewed before live calls.
   - Keep all SAP forwarding, GET-body support, endpoints, upload limits, and port 3008 behavior unchanged.

4. **Documentation and verification**
   - Update Windows instructions so `node server.js` is enough for first startup.
   - Test first startup with no `.env`, restart with the generated file, startup from another working folder, `/health` on port 3008, and no accidental secret output after the first run.
   - Confirm existing `.env` and `systems.json` files are never replaced.

## Scope protection

- No portal, workflow, Print Form, SAP payload, API Settings, or Quality deployment changes.
- No real credential or generated secret will be committed to the project.
