#!/usr/bin/env bash
# eNFA QUALITY - build + release helper.
#
#   sudo -iu enfa
#   cd /opt/enfa/app
#   PGPASSWORD='<POSTGRES_PASSWORD>' ./deploy/scripts/deploy-quality.sh
#
# Steps: git pull -> npm ci -> build (with VITE_* from the env file)
#        -> run migrations -> restart services -> health check
#
# Flags:
#   SKIP_PULL=1        do not git pull
#   SKIP_MIGRATIONS=1  do not touch the database
#   SKIP_RESTART=1     build only

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/enfa/app}"
ENV_FILE="${ENV_FILE:-/opt/enfa/app.env}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

cd "$APP_DIR"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (copy deploy/env/app.env.quality.example)"; exit 1; }

if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  step "Pulling latest code"
  git pull --ff-only
fi

step "Loading env from $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

step "Installing dependencies"
npm ci

step "Building (VITE_* baked in now)"
npm run build
[[ -f .output/server/index.mjs ]] || { echo "Build output .output/server/index.mjs not found"; exit 1; }
[[ -d dist ]] || { echo "Public assets directory dist/ not found"; exit 1; }

step "Publishing static frontend to /opt/enfa/frontend"
sudo mkdir -p /opt/enfa/frontend
sudo rsync -a --delete dist/ /opt/enfa/frontend/



if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  step "Applying database migrations"
  ./deploy/scripts/run-migrations.sh
fi

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  step "Restarting services"
  sudo systemctl restart enfa-app
  sudo systemctl restart enfa-middleware || true

  sleep 3
  step "Health checks"
  curl -sS -o /dev/null -w 'app       : HTTP %{http_code}\n' http://127.0.0.1:3000/ || true
  curl -sS -o /dev/null -w 'middleware: HTTP %{http_code}\n' http://127.0.0.1:3005/health || true
fi

step "Done"
echo "App     : http://<SERVER_IP>:8081"
echo "Supabase: http://<SERVER_IP>:8001    Studio: http://<SERVER_IP>:8082"
