# Diagnose and fix the Quality REST 401

## Current confirmed state

- The Nginx rule is correct: `/auth/v1/` and `/rest/v1/` are proxied to the Quality API gateway on port `8001`.
- The browser reaches that gateway, which returns `{"message":"Invalid authentication credentials"}` before the database can evaluate roles or permissions.
- The database already contains Admin screen permissions, so no role migration should be run for this gateway error.
- The Compose stack is located at:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/docker-compose-quality.yml
```

- The running Kong container is healthy and uses its standard startup:

```text
entrypoint=/docker-entrypoint.sh
cmd=kong docker-start
KONG_DECLARATIVE_CONFIG=/var/lib/kong/kong.yml
```

- The host file `/opt/Ramky_Applications/NFA-Approval/Quality/backend/volumes/api/kong.yml` is mounted at that path and exists. The earlier `/home/kong/kong.yml` check used the wrong path; it did not prove the config was unrendered.

## 1. Compare the three API-key sources without exposing keys

Run this exact block. It prints only SHA-256 hashes, never the keys:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend

if grep -Fq '${ANON_KEY}' volumes/api/kong.yml; then
  echo 'KONG_MODE=UNRENDERED_PLACEHOLDER'
else
  echo 'KONG_MODE=CONCRETE_KEY'
fi

KONG_HASH=$(awk '
  /username:[[:space:]]*anon/{found=1; next}
  found && /key:[[:space:]]*/ {
    sub(/^[^:]*:[[:space:]]*/, "");
    gsub(/^['\"']|['\"']$/, "");
    print; exit
  }
' volumes/api/kong.yml | sha256sum | cut -d' ' -f1)

BACKEND_HASH=$(bash -c '
  set -a; . ./.env; set +a
  printf %s "$ANON_KEY" | sha256sum | cut -d" " -f1
')

FRONTEND_HASH=$(bash -c '
  set -a; . ../frontend.env; set +a
  printf %s "$VITE_SUPABASE_PUBLISHABLE_KEY" | sha256sum | cut -d" " -f1
')

printf 'Kong config: %s\nBackend env: %s\nFrontend env: %s\n' \
  "$KONG_HASH" "$BACKEND_HASH" "$FRONTEND_HASH"
```

All three hashes must be identical. Their values can safely be compared, but the underlying keys must not be pasted into chat.

## 2. Fix the exact mismatch shown by the hashes

### Result A — `KONG_MODE=UNRENDERED_PLACEHOLDER`

The mounted YAML was never rendered, so Kong registered the placeholder rather than the real Quality anon key. Update the Kong service to render the mounted template before startup:

```yaml
kong:
  entrypoint:
    - bash
    - -c
    - |
      eval "echo \"$(cat /home/kong/kong.template.yml)\"" > /tmp/kong.yml
      exec /docker-entrypoint.sh kong docker-start
  environment:
    KONG_DATABASE: "off"
    KONG_DECLARATIVE_CONFIG: /tmp/kong.yml
    KONG_DNS_ORDER: LAST,A,CNAME
    KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth,rate-limiting,response-transformer,file-log
    ANON_KEY: ${ANON_KEY}
    SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
  volumes:
    - ./volumes/api/kong.yml:/home/kong/kong.template.yml:ro
```

Then recreate only Kong:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
docker compose -p nfa-quality -f docker-compose-quality.yml up -d --force-recreate kong
docker logs nfa-quality-kong --tail 80
```

This does not restart the database or alter users, roles, or permissions.

### Result B — Kong hash and backend hash match, but frontend hash differs

The deployed browser bundle contains the wrong API key. Update `frontend.env` with the Quality `ANON_KEY`, rebuild because `VITE_*` values are embedded at build time, and restart only `NFA-Portal-App` with `--update-env`.

### Result C — Kong hash differs from backend hash

The gateway config contains an old/static key. Use the same template-rendering fix from Result A so Kong receives the current `ANON_KEY` and `SERVICE_ROLE_KEY` from the Quality backend `.env`, then recreate only Kong.

### Result D — all three hashes match

The key-auth credentials are consistent. Check Kong's error log for the rejected request and then compare Auth/REST JWT-secret hashes; do not change roles or migrations:

```bash
docker logs nfa-quality-kong --tail 100

AUTH_HASH=$(docker inspect nfa-quality-auth --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^GOTRUE_JWT_SECRET=//p' | sha256sum | cut -d' ' -f1)
REST_HASH=$(docker inspect nfa-quality-rest --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^PGRST_JWT_SECRET=//p' | sha256sum | cut -d' ' -f1)
printf 'Auth JWT: %s\nREST JWT: %s\n' "$AUTH_HASH" "$REST_HASH"
```

## 3. Verify the REST gateway before testing roles

After the gateway fix:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
set -a
. ./.env
set +a

curl -i 'http://127.0.0.1:8001/rest/v1/role_permission?select=role_key,screen,allowed&limit=1' \
  -H "apikey: $ANON_KEY"
```

The exact gateway response `{"message":"Invalid authentication credentials"}` must be gone. A later database/RLS response is a separate layer and can then be diagnosed accurately.

Clear browser site data for `10.200.1.7:8081`, reload, and sign in again. For a signed-in REST request:

- `apikey` should be the Quality anon key.
- `Authorization` should be the newly issued user access token, not the same value as `apikey`.

## 4. Diagnose User ID `0056` only after the API gateway passes

The `Invalid login credentials` message is separate from the REST gateway 401. Verify that `0056` resolves to an existing auth account:

```sql
select u.id, u.email, u.email_confirmed_at,
       p.username, p.status
from auth.users u
left join public.profiles p on p.id = u.id
where lower(p.username) = lower('0056')
   or lower(u.email) = lower('0056');
```

If no row is returned, `0056` is not currently a valid User ID in this Quality database. Create the user through User Management after the gateway/server functions are healthy. If a row is returned, validate/reset that account’s password through the supported admin flow rather than inserting a duplicate user or manually editing password hashes.

## Project hardening

After recovery, apply the confirmed Kong mount/startup correction to the deployment kit so future Quality deployments reproduce the working gateway. Rotate the previously exposed Quality keys afterward and do not paste the replacements into chat.