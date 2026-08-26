# Diagnose and fix the Quality REST 401

## Current confirmed state

- The Nginx rule is correct: `/auth/v1/` and `/rest/v1/` are proxied to the Quality API gateway on port `8001`.
- The browser reaches that gateway, which returns `{"message":"Invalid authentication credentials"}` before the database can evaluate roles or permissions.
- The database already contains Admin screen permissions, so no role migration should be run for this gateway error.
- The Compose stack is located at:

```text
/opt/Ramky_Applications/NFA-Approval/Quality/backend/docker-compose-quality.yml
```

- The expected `/home/kong/kong.yml` does not exist in the running container. This means the running Kong container does not match the assumed mount/config path. The exact gateway cause must now be confirmed from the container rather than guessed.

## 1. Inspect the running Kong configuration without exposing keys

Run these commands exactly:

```bash
docker inspect nfa-quality-kong --format \
'entrypoint={{json .Config.Entrypoint}}
cmd={{json .Config.Cmd}}
{{range .Config.Env}}{{if eq (index (split . "=") 0) "KONG_DECLARATIVE_CONFIG"}}{{println .}}{{end}}{{end}}'

docker inspect nfa-quality-kong --format \
'{{range .Mounts}}{{println .Source " -> " .Destination}}{{end}}'

docker exec nfa-quality-kong sh -lc '
  printf "KONG_DECLARATIVE_CONFIG=%s\n" "${KONG_DECLARATIVE_CONFIG:-NOT_SET}"
  p="${KONG_DECLARATIVE_CONFIG:-/etc/kong/kong.yml}"
  if [ -f "$p" ]; then
    echo "CONFIG_FOUND=$p"
  else
    echo "CONFIG_MISSING=$p"
  fi
'
```

These outputs identify:

1. the path Kong was actually told to load,
2. the host file mounted into the container,
3. whether the container was created from the current Compose definition.

Do not print the content of the config or environment because it may contain API keys.

## 2. Compare the running container with the Compose definition

From the confirmed backend folder:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend

docker compose -p nfa-quality -f docker-compose-quality.yml config --services

docker compose -p nfa-quality -f docker-compose-quality.yml config \
  | sed -n '/^[[:space:]]*kong:/,/^[[:space:]]*[a-zA-Z0-9_-]*:/p' \
  | grep -E 'entrypoint|KONG_DECLARATIVE_CONFIG|source:|target:'
```

Only the filtered structural lines should be shown; do not share a full rendered Compose file because it can include secrets.

## 3. Fix according to the inspection result

### Case A — mount/config path differs from the Compose file

Recreate only Kong from the confirmed Compose file:

```bash
cd /opt/Ramky_Applications/NFA-Approval/Quality/backend
docker compose -p nfa-quality -f docker-compose-quality.yml up -d --force-recreate kong
docker logs nfa-quality-kong --tail 80
```

This does not restart the database or alter users, roles, or permissions.

### Case B — config exists but contains unrendered `${ANON_KEY}` placeholders

The gateway startup must render the template before Kong starts. Update the Kong service to mount the source as a template, explicitly provide the two key variables, render to `/tmp/kong.yml`, and point `KONG_DECLARATIVE_CONFIG` there:

```yaml
kong:
  entrypoint:
    - bash
    - -c
    - |
      eval "echo \"$(cat /home/kong/kong.template.yml)\"" > /tmp/kong.yml
      exec kong start
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

Then recreate only Kong using the Case A command.

### Case C — config is rendered, but the API key is still rejected

Compare the Quality backend key with the frontend build key using hashes only:

```bash
BACKEND_HASH=$(sed -n 's/^ANON_KEY=//p' \
  /opt/Ramky_Applications/NFA-Approval/Quality/backend/.env \
  | sha256sum | cut -d' ' -f1)

FRONTEND_HASH=$(sed -n 's/^VITE_SUPABASE_PUBLISHABLE_KEY=//p' \
  /opt/Ramky_Applications/NFA-Approval/Quality/frontend.env \
  | sha256sum | cut -d' ' -f1)

printf 'Backend ANON hash: %s\nFrontend publishable hash: %s\n' \
  "$BACKEND_HASH" "$FRONTEND_HASH"
```

The hashes must be identical. If they differ, update `frontend.env` with the Quality `ANON_KEY`, rebuild the frontend because `VITE_*` values are embedded at build time, and restart only `NFA-Portal-App` with `--update-env`.

## 4. Verify the REST gateway before testing roles

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

## 5. Diagnose User ID `0056` only after the API gateway passes

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