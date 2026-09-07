# Fix Windows build and Quality auth/realtime startup

## Scope
Resolve both current deployment blockers without changing application features, APIs, UI, other Docker projects, Nginx, or occupied ports.

## 1. Capture the actual container errors first
Run these as two separate commands (do not type the word `and` or include backticks):

```bash
docker logs nfa-quality-auth --tail 100
docker logs nfa-quality-realtime --tail 100
```

The Compose status only confirms that health checks failed; it does not reveal whether the cause is database credentials, initialization SQL, environment values, a migration failure, or an incorrect health endpoint. The log output will determine the precise correction.

Also inspect the resolved configuration without printing secret values:

```bash
docker compose -p nfa-quality config --services
docker compose -p nfa-quality ps -a
```

## 2. Correct the isolated Quality backend configuration
Based on the logs:
- Fix the auth database connection/bootstrap or health check if auth is running but incorrectly reported unhealthy.
- Fix the realtime database role/schema/tenant configuration or health check if realtime is running but incorrectly reported unhealthy.
- Keep all names, network, volumes, and ports scoped to `nfa-quality`.
- Update the Quality runbook with exact recovery and verification commands.
- If initialization SQL must rerun, use only `docker compose -p nfa-quality down -v`; this removes only the new Quality volumes and does not touch other applications.

## 3. Fix the Windows TipTap build installation
Confirmed from the repository:
- `RichTextEditor.tsx` correctly imports `@tiptap/extension-table`.
- The package is declared in both `package.json` and `bun.lock`.
- There is no npm `package-lock.json`, so `npm ci` is not valid for this checkout.

Keep table editing unchanged and use the repository's Bun lockfile:

```powershell
Remove-Item -Recurse -Force node_modules
bun install --frozen-lockfile
bun run build
```

If Bun is unavailable, use `npm install` followed by `npm run build`, not `npm ci`.

Update `deployment/Quality/scripts/deploy-quality.sh` to use the same lockfile-compatible install command so server deployment does not fail for the same reason.

## 4. Verify
- Validate the resolved Compose configuration and Quality shell scripts.
- Start only the `nfa-quality` project and confirm auth, realtime, meta, Kong, and Studio become healthy/running.
- Run one production build and confirm `dist/server/index.mjs` is generated.
- Document the final server commands and the expected healthy status.
