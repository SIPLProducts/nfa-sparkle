#!/usr/bin/env bash
# Repair built-in database role passwords in the existing Quality volume.
# This touches only the nfa-quality-db container and never prints the password.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-nfa-quality}"
DB_CONTAINER="${DB_CONTAINER:-nfa-quality-db}"

# Resolve the Quality root from this script's own location so it can be run
# from any directory (e.g. from inside scripts/ or from the Quality root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${BACKEND_DIR:-}" ]]; then
  if [[ -f "$SCRIPT_DIR/../backend/docker-compose.yml" ]]; then
    BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
  else
    BACKEND_DIR="/apps/webapplications/NFA_Approval/Quality/backend"
  fi
fi

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

[[ "$PROJECT_NAME" == "nfa-quality" ]] || { echo "Refusing non-Quality project: $PROJECT_NAME"; exit 1; }
[[ "$DB_CONTAINER" == "nfa-quality-db" ]] || { echo "Refusing non-Quality database: $DB_CONTAINER"; exit 1; }
[[ -f "$BACKEND_DIR/docker-compose.yml" ]] || { echo "Missing $BACKEND_DIR/docker-compose.yml"; exit 1; }

step "Checking the Quality database"
docker inspect "$DB_CONTAINER" >/dev/null
[[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER")" == "true" ]] || {
  echo "$DB_CONTAINER is not running"; exit 1;
}

step "Synchronizing Quality internal role passwords"
cat <<'SQL' | docker exec -i "$DB_CONTAINER" sh -eu -c '
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is missing in the Quality DB container}"
  psql --username "${POSTGRES_USER:-postgres}" --dbname "${POSTGRES_DB:-postgres}" \
    --set=ON_ERROR_STOP=1 --set=role_password="$POSTGRES_PASSWORD"
'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, :'role_password')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'supabase_admin',
  'supabase_auth_admin',
  'supabase_functions_admin',
  'supabase_read_only_user',
  'supabase_storage_admin'
)
\gexec
SQL

step "Restarting only Quality Auth, Realtime, and Meta"
docker compose -p "$PROJECT_NAME" -f "$BACKEND_DIR/docker-compose.yml" \
  --env-file "$BACKEND_DIR/.env" restart auth realtime meta

step "Waiting for Quality service health"
for attempt in $(seq 1 45); do
  states="$(docker inspect -f '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    nfa-quality-auth nfa-quality-realtime nfa-quality-meta 2>/dev/null || true)"
  if ! grep -Eq 'starting|unhealthy|created|exited' <<<"$states"; then break; fi
  sleep 2
done
docker inspect -f '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  nfa-quality-auth nfa-quality-realtime nfa-quality-meta

if docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  nfa-quality-auth nfa-quality-realtime nfa-quality-meta | grep -Eq 'starting|unhealthy|created|exited'; then
  echo "One or more Quality services are not healthy. Fresh scoped logs:"
  docker logs nfa-quality-auth --since 5m --tail 80 || true
  docker logs nfa-quality-realtime --since 5m --tail 80 || true
  docker logs nfa-quality-meta --since 5m --tail 80 || true
  exit 1
fi

step "Starting the remaining Quality services"
docker compose -p "$PROJECT_NAME" -f "$BACKEND_DIR/docker-compose.yml" \
  --env-file "$BACKEND_DIR/.env" up -d
docker compose -p "$PROJECT_NAME" -f "$BACKEND_DIR/docker-compose.yml" \
  --env-file "$BACKEND_DIR/.env" ps