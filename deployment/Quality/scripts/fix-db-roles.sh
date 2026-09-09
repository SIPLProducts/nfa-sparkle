#!/usr/bin/env bash
# Repair the Quality database role passwords so they match backend/.env, then
# recreate only the Quality containers so they pick up the current settings.
#
# The password is read from backend/.env (NOT from the running container, which
# may still hold an older value) and is never printed.
#
# Usage:
#   cd /apps/webapplications/NFA_Approval/Quality
#   ./scripts/fix-db-roles.sh
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
[[ -f "$BACKEND_DIR/.env" ]] || { echo "Missing $BACKEND_DIR/.env"; exit 1; }

COMPOSE=(docker compose -p "$PROJECT_NAME" -f "$BACKEND_DIR/docker-compose.yml" --env-file "$BACKEND_DIR/.env")
QUALITY_SERVICES=(auth rest realtime storage meta kong studio)
WATCH=(nfa-quality-auth nfa-quality-realtime nfa-quality-meta nfa-quality-kong nfa-quality-studio)
NOT_READY='starting|unhealthy|created|exited|restarting'

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

step "Warning if the API keys do not match JWT_SECRET"
if command -v python3 >/dev/null 2>&1; then
  JWT_SECRET="$(read_env JWT_SECRET)" \
  ANON_KEY="$(read_env ANON_KEY)" \
  SERVICE_ROLE_KEY="$(read_env SERVICE_ROLE_KEY)" python3 - <<'PY' || true
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
    print("\n  These keys do not match JWT_SECRET. The stack will keep failing")
    print("  until they are replaced. Run ./scripts/generate-keys.sh first.\n")
PY
else
  echo "  python3 not available - skipped"
fi

step "Checking the Quality database"
docker inspect "$DB_CONTAINER" >/dev/null
[[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER")" == "true" ]] || {
  echo "$DB_CONTAINER is not running. Start it with:"
  echo "  cd $BACKEND_DIR && docker compose -p $PROJECT_NAME up -d db"
  exit 1
}

step "Applying the backend/.env password to the internal Quality roles"
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

step "Verifying a real supabase_admin login"
if docker exec -i \
  -e PGPASSWORD="$TARGET_PASSWORD" \
  -e TARGET_DB="$POSTGRES_DB_NAME" \
  "$DB_CONTAINER" sh -eu -c '
    psql --host 127.0.0.1 --port 5432 --username supabase_admin \
      --dbname "$TARGET_DB" --set=ON_ERROR_STOP=1 -tAq -c "select 1" >/dev/null
  '; then
  echo "supabase_admin can sign in with the backend/.env password."
else
  echo "supabase_admin STILL cannot sign in. Recent database log:"
  docker logs "$DB_CONTAINER" --since 5m --tail 60 2>&1 || true
  exit 1
fi

step "Recreating only the Quality services so they reload backend/.env"
# `restart` reuses the old environment; `up -d --force-recreate` does not.
"${COMPOSE[@]}" up -d --force-recreate --no-deps "${QUALITY_SERVICES[@]}"

step "Waiting for Quality service health (up to 2 minutes - do not press Ctrl+C)"
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
  echo "One or more Quality services are not healthy. Fresh scoped logs:"
  for c in "${WATCH[@]}"; do
    state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo unknown)"
    printf '\n----- %s (%s) -----\n' "$c" "$state"
    docker logs "$c" --since 5m --tail 80 2>&1 || true
  done
  exit 1
fi

step "Verifying the dashboard schema service"
if docker exec nfa-quality-meta wget -q -O - http://localhost:8080/tables?limit=1 >/dev/null 2>&1; then
  echo "The dashboard can read the schema list. The Table Editor error is cleared."
else
  echo "The dashboard schema service is still failing. Recent log:"
  docker logs nfa-quality-meta --since 5m --tail 80 2>&1 || true
  exit 1
fi

step "Starting any remaining Quality services"
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps

cat <<'TXT'

Done. Next:
  ./scripts/run-migrations.sh      # apply the schema and data
Then reload http://10.200.1.7:8082 and press "Reload schemas".
TXT
