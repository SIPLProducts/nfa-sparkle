# Restore Quality login and dashboard

## Confirmed from the supplied configuration

- `http://10.200.1.7:8021` is the Quality dashboard address in the active Nginx file. It proxies to `127.0.0.1:54323`.
- The Quality Compose configuration publishes the dashboard on `127.0.0.1:54323` only after its dependencies are healthy.
- Dashboard startup waits for Kong and Meta; Kong waits for Auth, Realtime, and Meta. Therefore, the 502 and failed application login share the same unavailable backend chain.
- The exact first failing container is not yet confirmed because the server health output and fresh container logs are not available here.
- The uploaded Nginx file uses dashboard port `8021`, while the repository's canonical file documents `8082`. Diagnosis will use the active server configuration and will not change ports until the live config is verified.

## Safe recovery procedure

1. **Confirm the active files and first failed service**
   - Inspect the active Nginx configuration to verify that port 8021 points to `127.0.0.1:54323`.
   - Use only the deployed Quality Compose file and the `nfa-quality` project name.
   - Capture Quality-only container status and fresh logs for Auth, Realtime, Meta, Kong, and Studio.
   - Test ports 54321 and 54323 locally to distinguish a stopped upstream from an Nginx problem.

2. **Repair the existing database without deleting data**
   - Keep the existing `nfa-quality-db-data` volume.
   - Synchronize the stored passwords for the built-in database roles with the current `backend/.env` password using the existing repair script or its equivalent.
   - Verify real database logins for both `supabase_auth_admin` and `supabase_admin` before restarting dependent services.

3. **Validate keys and recreate Quality services**
   - Verify that `ANON_KEY` and `SERVICE_ROLE_KEY` are complete JWTs signed by the current `JWT_SECRET`.
   - Rotate the secrets previously exposed in chat and generate matching API keys; never print them in diagnostic output.
   - Recreate—not merely restart—only the Quality Auth, REST, Realtime, Storage, Meta, Kong, and Studio containers so they load the current environment.
   - Do not touch DEV/PROD containers, other applications, ports, or volumes.

4. **Verify in dependency order**
   - Database healthy and both required roles can connect.
   - Auth health succeeds inside its container.
   - Realtime and Meta become healthy.
   - Kong listens on `127.0.0.1:54321`; `/auth/v1/health` succeeds locally and through port 8001.
   - Studio listens on `127.0.0.1:54323`; port 8021 shows the dashboard login instead of 502.
   - Application login on port 8081 succeeds.

5. **Keep the frontend key synchronized**
   - If the anonymous key is rotated, place the same new value in the Quality frontend environment and rebuild/redeploy the complete `dist` folder once.
   - No frontend rebuild is needed when only database-role passwords are repaired.

## Safety rules

- Never run `docker compose down -v` or delete the Quality database volume.
- Never mix `docker-compose.yml` and `docker-compose-quality.yml` in one recovery attempt.
- Never paste passwords, JWT secrets, or API keys into chat or logs.
- No portal functionality or UI will be changed; this is a Quality backend recovery only.
