# Fix the Quality dashboard and migration connection

The latest output confirms two important facts:

- The database repair succeeded: `supabase_admin` logged in and returned `1`.
- The permission data is present: 28 rows, with 7 rows for each role, plus the required grants and read policies.

The dashboard still fails because Docker Compose stopped at a YAML syntax error before recreating Meta/Studio. Those containers therefore still hold the old database password. The migration script separately failed because it did not load `POSTGRES_PASSWORD` from the server's `.env`.

## 1. Inspect and repair the malformed Compose line

First make a backup and show the actual server lines around the reported error:

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
cp docker-compose.yml docker-compose.yml.before-fix
nl -ba docker-compose.yml | sed -n '300,314p'
```

The repository's correct storage-volume block is:

```yaml
    volumes:
      - type: volume
        source: nfa-quality-storage-data
        target: /var/lib/storage
    depends_on:
      db:
        condition: service_healthy
      rest:
        condition: service_started
```

Restore those exact lines if the server copy has merged text, an extra colon, or bad indentation near line 307. Then validate before starting anything:

```bash
docker compose -p nfa-quality --env-file .env config -q
echo $?
```

Continue only when the command prints no YAML error and the exit code is `0`.

## 2. Remove invalid non-variable lines from `.env`

`Quality: command not found` proves the file contains text that is not a comment or `NAME=value`. Do not source this file again.

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
cp .env .env.before-cleanup
grep -nEv '^[[:space:]]*($|#|[A-Za-z_][A-Za-z0-9_]*=)' .env
```

Delete or prefix with `#` only the lines reported by that command. Do not change the actual secret values. Re-run the `grep`; it should return no lines.

## 3. Recreate only the Quality services

```bash
cd /apps/webapplications/NFA_Approval/Quality/backend
docker compose -p nfa-quality --env-file .env up -d --force-recreate --no-deps \
  auth rest realtime storage meta kong studio
```

Wait and verify:

```bash
for i in $(seq 1 60); do
  STATE=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' nfa-quality-meta)
  echo "meta: $STATE"
  [ "$STATE" = healthy ] && break
  sleep 2
done

docker ps --filter 'name=nfa-quality' --format 'table {{.Names}}\t{{.Status}}'
docker logs nfa-quality-meta --since 3m --tail 50
```

This touches only `nfa-quality-*`. Do not restart or modify the DEV/PROD containers.

## 4. Run migrations with an explicitly loaded password

Use a parser that reads only the password assignment and does not execute the `.env` file:

```bash
cd /apps/webapplications/NFA_Approval/Quality
PW=$(sed -n 's/^[[:space:]]*POSTGRES_PASSWORD[[:space:]]*=[[:space:]]*//p' backend/.env \
  | tail -n1 | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

test -n "$PW" || { echo 'POSTGRES_PASSWORD was not found'; exit 1; }
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAqc 'select 1'
PGPASSWORD="$PW" ./scripts/run-migrations.sh
unset PW
```

The first command must return `1`; the migration runner should then apply or skip files without prompting.

## 5. Final verification

```bash
curl -i http://127.0.0.1:8001/auth/v1/health
curl -i http://127.0.0.1:8082/
docker logs nfa-quality-meta --since 2m --tail 30
```

Then reload `http://10.200.1.7:8082`. Users, tables, and schemas should load because Meta is now running with the same password already verified against `supabase_admin`.

## Safety

- Preserve the existing `nfa-quality` database volume and its 10 users, 10 profiles, and 28 permission rows.
- Do not regenerate keys or passwords; the direct login proved the current database password is valid.
- Do not rebuild the application and do not touch DEV/PROD containers.
