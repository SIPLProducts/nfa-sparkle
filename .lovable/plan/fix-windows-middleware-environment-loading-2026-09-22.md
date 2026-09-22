# Fix Windows middleware environment loading

## Confirmed issue

The middleware exits because `process.env.PROXY_SECRET` is empty after `dotenv` runs. The current code calls `require("dotenv").config()` without an explicit file path, so loading depends on the process working directory. It also reports every loading problem as “PROXY_SECRET is not set,” which does not distinguish a missing `.env`, a Windows `.env.txt` filename, an unreadable file, or a missing variable.

The checked-in middleware template currently defaults to port **3005**, while the supplied Windows configuration and portal setup use **3008**.

## Changes

1. **Load configuration reliably on Windows and Linux**
   - Resolve `.env` from the same directory as `server.js`, independent of the folder from which Node or a service manager starts it.
   - Detect and report dotenv parsing/loading errors without printing any secret value.
   - If `.env` is absent, identify the exact expected path and mention the common Windows `.env.txt` filename problem.
   - Keep startup blocked when `PROXY_SECRET` is genuinely absent; do not silently use `.env.example` or an insecure default.

2. **Align the downloadable middleware with port 3008**
   - Set the standalone middleware example and instructions to port 3008, matching the supplied configuration.
   - Update startup comments, health-check examples, ngrok command, and portal configuration instructions consistently.
   - Preserve the separate Quality deployment port arrangement and all SAP forwarding behavior.

3. **Improve Windows setup instructions**
   - Add PowerShell commands to create the real `.env` and `systems.json` files.
   - Explain how to verify the filename and run the middleware from PowerShell.
   - Replace the weak example secret with guidance to generate a long random value and use the same value in SAP API Settings.

4. **Focused verification**
   - Start the middleware from both its own folder and the project root using a temporary test configuration.
   - Confirm `/health` responds on port 3008 and reports middleware version/get-body support.
   - Confirm startup errors clearly distinguish a missing `.env` from a missing `PROXY_SECRET`.
   - Confirm GET requests with JSON bodies, SAP credentials, upload limits, and all existing endpoints remain unchanged.

## Scope protection

- No changes to portal workflows, SAP API payloads, authentication behavior, saved settings, Print Form, or deployment services.
- No real proxy secret or SAP credential will be committed to the project.
