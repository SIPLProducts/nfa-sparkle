#!/usr/bin/env bash
# eNFA QUALITY - build + release helper.
#
#   cd /apps/webapplications/NFA_Approval/Quality
#   PGPASSWORD='<POSTGRES_PASSWORD>' ./scripts/deploy-quality.sh
#
# Steps: build the frontend from the source checkout (with the Quality VITE_*
#        values), publish dist/, apply migrations, restart app + middleware.
#
# Flags:
#   SKIP_BUILD=1       reuse the existing build output
#   SKIP_MIGRATIONS=1  do not touch the database
#   SKIP_RESTART=1     build and publish only

set -euo pipefail

QUALITY_ROOT="${QUALITY_ROOT:-/apps/webapplications/NFA_Approval/Quality}"
SRC_DIR="${SRC_DIR:-$QUALITY_ROOT/src}"                 # git checkout of the app
ENV_FILE="${ENV_FILE:-$QUALITY_ROOT/frontend/.env}"
FRONTEND_DIR="${FRONTEND_DIR:-$QUALITY_ROOT/frontend/dist}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Preflight"
printf 'Quality root : %s\nSource       : %s\nEnv file     : %s\nPublish to   : %s\n' \
  "$QUALITY_ROOT" "$SRC_DIR" "$ENV_FILE" "$FRONTEND_DIR"

[[ -d "$SRC_DIR" ]]   || { echo "Missing source checkout $SRC_DIR"; exit 1; }
[[ -f "$ENV_FILE" ]]  || { echo "Missing $ENV_FILE (copy frontend/.env.example)"; exit 1; }

step "Loading env from $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  cd "$SRC_DIR"
  step "Installing dependencies"
  npm ci

  step "Building (VITE_* baked in now)"
  npm run build
  [[ -f dist/server/index.mjs ]] || { echo "Build output dist/server/index.mjs not found"; exit 1; }

  step "Publishing static frontend to $FRONTEND_DIR"
  mkdir -p "$FRONTEND_DIR"
  rsync -a --delete --exclude "server/" dist/ "$FRONTEND_DIR/"

  step "Publishing Node SSR bundle to $QUALITY_ROOT/frontend/server"
  rsync -a --delete dist/server/ "$QUALITY_ROOT/frontend/server/"
fi

if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  step "Applying database migrations"
  QUALITY_ROOT="$QUALITY_ROOT" "$QUALITY_ROOT/scripts/run-migrations.sh"
fi

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  step "Restarting Quality services (Quality only)"
  sudo systemctl restart enfa-quality-app || true
  pm2 restart enfa-quality-middleware || true

  sleep 3
  step "Health checks"
  curl -sS -o /dev/null -w 'app       : HTTP %{http_code}\n' http://127.0.0.1:3000/ || true
  curl -sS -o /dev/null -w 'middleware: HTTP %{http_code}\n' http://127.0.0.1:3005/health || true
fi

step "Done"
echo "App     : http://10.200.1.7:8081"
echo "Supabase: http://10.200.1.7:8001    Studio: http://10.200.1.7:8082"
