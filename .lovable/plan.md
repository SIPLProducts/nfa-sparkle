# Handle middleware port 3008 conflicts safely

## Confirmed cause

The middleware successfully created `.env` and `systems.json`, then failed because another process was already listening on port **3008**. The current startup code calls `app.listen(...)` without an error handler, so Node prints an unhandled `EADDRINUSE` stack trace.

There is also a first-run edge case: the generated Proxy Secret is currently printed only after the server starts listening. Because startup failed, that one-time message was never shown.

## Changes

1. Add focused startup error handling to both middleware packages without changing SAP forwarding or API behavior.
2. When port 3008 is occupied, replace the crash stack with a clear message explaining that an existing middleware or another application is already using the port.
3. Check the local `/health` endpoint to distinguish an already-running eNFA middleware from an unrelated process:
   - If it is eNFA middleware, report that it is already running and avoid starting a duplicate.
   - Otherwise, show safe PowerShell commands to identify the process, or instruct the user to select another port and update ngrok/API Settings consistently.
4. Ensure a newly generated Proxy Secret is shown once even when the first startup encounters a port conflict, while never logging an existing saved secret.
5. Update the Windows troubleshooting section with the exact port-check and stop commands.

## Validation

- Start normally on a free port and confirm `/health` responds.
- Start a second copy on the same port and confirm there is no unhandled stack trace.
- Test both the “existing eNFA middleware” and “unrelated process” messages.
- Confirm first-run files remain preserved and existing `.env`, `systems.json`, SAP forwarding, and port settings are unchanged.
