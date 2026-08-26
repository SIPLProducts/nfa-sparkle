# Fix the Quality API 401 first

## Confirmed issue

The failing `/rest/v1/role_permission` call is rejected by the API gateway before it reaches the database. This is why the response is:

```json
{"message":"Invalid authentication credentials"}
```

This is **not** caused by missing user roles, permissions, or migrations.

The Quality gateway configuration contains literal placeholders:

```yaml
key: ${ANON_KEY}
key: ${SERVICE_ROLE_KEY}
```

but the gateway container starts directly with `kong start`. That startup command does not render the placeholders. The browser sends the real Quality `apikey`, while the gateway expects the literal placeholder, so every protected `/rest/v1/*` request receives 401.

The Auth route does not use the gateway's `key-auth` plugin, which explains why Auth and REST can behave differently. The separate `Invalid login credentials` message must be checked only after the gateway API-key problem is fixed.

## 1. Confirm the unrendered gateway config

Run this on the Ubuntu server:

```bash
docker exec nfa-quality-kong grep -Fq '${ANON_KEY}' /home/kong/kong.yml \
  && echo 'CONFIRMED: gateway config is unrendered' \
  || echo 'Gateway config is rendered; inspect container logs'
```

If it prints `CONFIRMED`, no role SQL or migration should be run for this 401.

## 2. Locate the exact Compose stack

Do not guess its folder. Read it from the running container:

```bash
docker inspect nfa-quality-kong --format \
'dir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
file={{index .Config.Labels "com.docker.compose.project.config_files"}}
project={{index .Config.Labels "com.docker.compose.project"}}'
```

Use the printed directory and Compose filename in the next step.

## 3. Render the gateway config at container startup

Update the gateway service in the actual Compose file so it renders environment variables before starting Kong:

```yaml
kong:
  entrypoint:
    - bash
    - -c
    - |
      eval "echo \"$(cat /home/kong/kong.template.yml)\"" > /tmp/kong.yml
      exec kong start -c /etc/kong/kong.conf --conf /dev/null
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

Technical requirement: `ANON_KEY` and `SERVICE_ROLE_KEY` must be explicitly present in the gateway container environment. The source template remains read-only; the rendered file is created only inside the container.

Before recreating it, confirm the stack `.env` has the matching values without printing them:

```bash
cd <working directory printed above>
grep -cE '^(ANON_KEY|SERVICE_ROLE_KEY)=' .env
```

Expected result: `2`.

## 4. Recreate only the gateway

From the real Compose working directory:

```bash
docker compose -f <compose filename printed above> up -d --force-recreate kong
docker logs nfa-quality-kong --tail 50
```

This does not restart the database and does not affect users or role data.

Confirm that the running config no longer contains placeholders:

```bash
docker exec nfa-quality-kong grep -Fq '${ANON_KEY}' /tmp/kong.yml \
  && echo 'FAILED: placeholder remains' \
  || echo 'OK: gateway config rendered'
```

## 5. Verify the API before testing login

First verify that the gateway accepts the anon key. Load the Quality backend `.env` without displaying its values:

```bash
set -a
. ./.env
set +a
curl -i 'http://127.0.0.1:8001/rest/v1/role_permission?select=role_key,screen,allowed&limit=1' \
  -H "apikey: $ANON_KEY"
```

A database/RLS response such as `200`, `401` with a PostgREST JSON error, or `403` proves the gateway credential check passed. The exact gateway body `{"message":"Invalid authentication credentials"}` must be gone.

Then clear site data for `10.200.1.7:8081`, reload, and sign in again. A signed-in REST request should contain:

- `apikey`: the Quality anon key
- `Authorization: Bearer ...`: the newly issued **user access token**, not the same anon key

## 6. Handle login credentials separately

If the login form still says `Invalid login credentials` after the REST gateway is fixed, verify the account exists and identify whether User ID resolution is working:

```sql
select u.id, u.email, u.email_confirmed_at,
       p.username, p.status
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('masteradmin@sharviinfotech.com')
   or lower(p.username) = lower('masteradmin');
```

If the row exists and is active, reset the password through the supported admin flow rather than inserting another user or editing password hashes manually.

## Project hardening

After the server is restored, update the deployment kit in the project with the same rendered gateway startup so future deployments do not recreate this 401. The previously pasted Quality keys should also be rotated after service recovery; do not paste replacement keys into chat.
