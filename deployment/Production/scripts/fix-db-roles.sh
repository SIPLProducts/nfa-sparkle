#!/usr/bin/env bash
# Repair the Production database role passwords so they match backend/.env, then
# recreate only the Production containers so they pick up the current settings.
#
# The password is read from backend/.env (NOT from the running container, which
# may still hold an older value) and is never printed.
#
# Usage:
#   cd /apps/webapplications/NFA_Approval/Production
#   ./scripts/fix-db-roles.sh
#
# If both compose filenames exist and differ, select the deployed one explicitly:
#   COMPOSE_FILE=backend/docker-compose-production.yml ./scripts/fix-db-roles.sh
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-nfa-production}"
DB_CONTAINER="${DB_CONTAINER:-nfa-production-db}"

# Resolve the Production root from this script's own location so it can be run
# from any directory (e.g. from inside scripts/ or from the Production root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${BACKEND_DIR:-}" ]]; then
  if [[ -f "$SCRIPT_DIR/../backend/docker-compose.yml" ]]; then
    BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
  else
    BACKEND_DIR="/apps/webapplications/NFA_Approval/Production/backend"
  fi
fi

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

[[ "$PROJECT_NAME" == "nfa-production" ]] || { echo "Refusing non-Production project: $PROJECT_NAME"; exit 1; }
[[ "$DB_CONTAINER" == "nfa-production-db" ]] || { echo "Refusing non-Production database: $DB_CONTAINER"; exit 1; }
[[ -f "$BACKEND_DIR/.env" ]] || { echo "Missing $BACKEND_DIR/.env"; exit 1; }

if [[ -n "${COMPOSE_FILE:-}" ]]; then
  if [[ "$COMPOSE_FILE" != /* ]]; then
    COMPOSE_FILE="$(pwd)/$COMPOSE_FILE"
  fi
  [[ -f "$COMPOSE_FILE" ]] || { echo "Missing selected compose file: $COMPOSE_FILE"; exit 1; }
else
  COMPOSE_STANDARD="$BACKEND_DIR/docker-compose.yml"
  COMPOSE_PRODUCTION="$BACKEND_DIR/docker-compose-production.yml"
  if [[ -f "$COMPOSE_STANDARD" && -f "$COMPOSE_PRODUCTION" ]]; then
    if cmp -s "$COMPOSE_STANDARD" "$COMPOSE_PRODUCTION"; then
      COMPOSE_FILE="$COMPOSE_PRODUCTION"
    else
      echo "Both compose files exist and differ. Refusing to guess which stack definition is deployed."
      echo "Run one of these explicitly:"
      echo "  COMPOSE_FILE=$COMPOSE_PRODUCTION ./scripts/fix-db-roles.sh"
      echo "  COMPOSE_FILE=$COMPOSE_STANDARD ./scripts/fix-db-roles.sh"
      exit 1
    fi
  elif [[ -f "$COMPOSE_PRODUCTION" ]]; then
    COMPOSE_FILE="$COMPOSE_PRODUCTION"
  elif [[ -f "$COMPOSE_STANDARD" ]]; then
    COMPOSE_FILE="$COMPOSE_STANDARD"
  else
    echo "No Production compose file found in $BACKEND_DIR"
    exit 1
  fi
fi

COMPOSE=(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$BACKEND_DIR/.env")
PRODUCTION_SERVICES=(auth rest realtime storage meta kong studio)
WATCH=(nfa-production-auth nfa-production-realtime nfa-production-meta nfa-production-kong nfa-production-studio)
NOT_READY='starting|unhealthy|created|exited|restarting'

step "Using one Production compose file"
echo "$COMPOSE_FILE"
"${COMPOSE[@]}" config -q

read_env() {
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$BACKEND_DIR/.env" \
    | tail -n1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
          -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

step "Reading the intended password from backend/.env"
TARGET_PASSWORD="$(read_env POSTGRES_PASSWORD)"
POSTGRES_DB_NAME="$(read_env POSTGRES_DB)"; POSTGRES_DB_NAME="${POSTGRES_DB_NAME:-postgres}"
[[ -n "$TARGET_PASSWORD" ]] || { echo "POSTGRES_PASSWORD is empty in $BACKEND_DIR/.env"; exit 1; }
case "$TARGET_PASSWORD" in
  *"<"*|*">"*) echo "POSTGRES_PASSWORD in backend/.env looks like placeholder text."; exit 1 ;;
esac
echo "OK (value hidden)"

step "Validating that the API keys match JWT_SECRET"
if command -v python3 >/dev/null 2>&1; then
  if ! JWT_SECRET="$(read_env JWT_SECRET)" \
    ANON_KEY="$(read_env ANON_KEY)" \
    SERVICE_ROLE_KEY="$(read_env SERVICE_ROLE_KEY)" python3 - <<'PY'
import base64, hashlib, hmac, os
secret = os.environ.get("JWT_SECRET", "").encode()
bad = []
for name in ("ANON_KEY", "SERVICE_ROLE_KEY"):
    token = os.environ.get(name, "")
    ok = False
    if secret and token.count(".") == 2:
        header, payload, signature = token.split(".")
        expected = base64.urlsafe_b64encode(
            hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        ok = hmac.compare_digest(expected, signature)
    print(f"  {name:<16} {'OK' if ok else 'INVALID'}")
    if not ok:
        bad.append(name)
if bad:
    raise SystemExit(1)
PY
  then
    echo
    echo "ANON_KEY or SERVICE_ROLE_KEY is invalid for the current JWT_SECRET."
    echo "Run ./scripts/generate-keys.sh, replace both lines in backend/.env, then rerun this repair."
    exit 1
  fi
else
  echo "python3 is required to validate the Production API keys."
  exit 1
fi

step "Checking the Production database"
docker inspect "$DB_CONTAINER" >/dev/null
[[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER")" == "true" ]] || {
  echo "$DB_CONTAINER is not running. Start it with:"
  echo "  cd $BACKEND_DIR && docker compose -p $PROJECT_NAME up -d db"
  exit 1
}

step "Applying the backend/.env password to the internal Production roles"
# The password travels as a container env var, never on the command line and
# never in the output. psql substitutes it safely through :'role_password'.
docker exec -i \
  -e ROLE_PASSWORD="$TARGET_PASSWORD" \
  -e TARGET_DB="$POSTGRES_DB_NAME" \
  "$DB_CONTAINER" sh -eu -c '
    psql --username "${POSTGRES_USER:-postgres}" --dbname "$TARGET_DB" \
      --set=ON_ERROR_STOP=1 --set=role_password="$ROLE_PASSWORD" -q
  ' <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', rolname, :'role_password')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'postgres',
  'supabase_admin',
  'supabase_auth_admin',
  'supabase_functions_admin',
  'supabase_read_only_user',
  'supabase_storage_admin'
)
\gexec
SQL
echo "Role passwords synchronized."

step "Verifying the Auth and dashboard database accounts"
for db_user in supabase_auth_admin supabase_admin; do
  if docker exec -i \
    -e PGPASSWORD="$TARGET_PASSWORD" \
    -e TARGET_DB="$POSTGRES_DB_NAME" \
    -e TARGET_USER="$db_user" \
    "$DB_CONTAINER" sh -eu -c '
      psql --host 127.0.0.1 --port 5432 --username "$TARGET_USER" \
        --dbname "$TARGET_DB" --set=ON_ERROR_STOP=1 -tAq -c "select 1" >/dev/null
    '; then
    echo "$db_user can sign in with the backend/.env password."
  else
    echo "$db_user STILL cannot sign in. Recent database log:"
    docker logs "$DB_CONTAINER" --since 5m --tail 60 2>&1 || true
    exit 1
  fi
done

step "Recreating only the Production services so they reload backend/.env"
# `restart` reuses the old environment; `up -d --force-recreate` does not.
"${COMPOSE[@]}" up -d --force-recreate --no-deps "${PRODUCTION_SERVICES[@]}"

step "Waiting for Production service health (up to 2 minutes - do not press Ctrl+C)"
for attempt in $(seq 1 60); do
  states="$(docker inspect -f '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "${WATCH[@]}" 2>/dev/null || true)"
  if [[ -n "$states" ]] && ! grep -Eq "$NOT_READY" <<<"$states"; then break; fi
  printf '  [%02d/60] %s\n' "$attempt" "$(tr '\n' ' ' <<<"$states")"
  sleep 2
done
docker inspect -f '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  "${WATCH[@]}"

if docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
  "${WATCH[@]}" | grep -Eq "$NOT_READY"; then
  echo
  echo "One or more Production services are not healthy. Fresh scoped logs:"
  for c in "${WATCH[@]}"; do
    state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo unknown)"
    printf '\n----- %s (%s) -----\n' "$c" "$state"
    docker logs "$c" --since 5m --tail 80 2>&1 || true
  done
  exit 1
fi

step "Verifying the dashboard schema service"
if docker exec nfa-production-meta wget -q -O - http://localhost:8080/tables?limit=1 >/dev/null 2>&1; then
  echo "The dashboard can read the schema list. The Table Editor error is cleared."
else
  echo "The dashboard schema service is still failing. Recent log:"
  docker logs nfa-production-meta --since 5m --tail 80 2>&1 || true
  exit 1
fi

step "Starting any remaining Production services"
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps

cat <<'TXT'

Done. Next:
  ./scripts/run-migrations.sh      # apply the schema and data
Then reload the Studio port configured in your active Nginx file (8021 or 8092)
and press "Reload schemas".
TXT
