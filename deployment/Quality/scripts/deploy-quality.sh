#!/usr/bin/env bash
# eNFA QUALITY - build + release helper.
#
#   cd /apps/webapplications/NFA_Approval/Quality
#   ./scripts/deploy-quality.sh          # DB password read from backend/.env
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
RELEASE_TMP="${FRONTEND_DIR}.new"
RELEASE_OLD="${FRONTEND_DIR}.previous"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Preflight"
printf 'Quality root : %s\nSource       : %s\nEnv file     : %s\nPublish to   : %s\n' \
  "$QUALITY_ROOT" "$SRC_DIR" "$ENV_FILE" "$FRONTEND_DIR"

[[ -d "$SRC_DIR" ]]   || { echo "Missing source checkout $SRC_DIR. Set SRC_DIR to a folder containing package.json, or build elsewhere and copy dist/ manually."; exit 1; }
[[ -f "$ENV_FILE" ]]  || { echo "Missing $ENV_FILE (copy frontend/.env.example)"; exit 1; }

step "Loading env from $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  cd "$SRC_DIR"
  step "Installing dependencies"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    echo "package-lock.json not found; running npm install to create it"
    npm install
  fi

  step "Building (VITE_* baked in now)"
  npm run build
  for required in dist/server/index.mjs dist/manifest.webmanifest dist/public/manifest.webmanifest dist/ramky-logo.png dist/public/ramky-logo.png; do
    [[ -s "$required" ]] || { echo "Incomplete build: $required is missing or empty"; exit 1; }
  done
  [[ -n "$(find dist/assets -maxdepth 1 -type f -print -quit)" ]] || { echo "Incomplete build: dist/assets is empty"; exit 1; }
  [[ -n "$(find dist/public/assets -maxdepth 1 -type f -print -quit)" ]] || { echo "Incomplete build: dist/public/assets is empty"; exit 1; }

  step "Publishing one complete frontend release to $FRONTEND_DIR"
  rm -rf "$RELEASE_TMP"
  mkdir -p "$RELEASE_TMP"
  rsync -a --delete dist/ "$RELEASE_TMP/"
  rm -rf "$RELEASE_OLD"
  if [[ -d "$FRONTEND_DIR" ]]; then mv "$FRONTEND_DIR" "$RELEASE_OLD"; fi
  mv "$RELEASE_TMP" "$FRONTEND_DIR"
fi

if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  step "Applying database migrations"
  QUALITY_ROOT="$QUALITY_ROOT" "$QUALITY_ROOT/scripts/run-migrations.sh"
fi

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  step "Restarting Quality services (Quality only)"
  if pm2 describe enfa-quality-app >/dev/null 2>&1; then
    pm2 restart enfa-quality-app --update-env
  else
    sudo systemctl restart enfa-quality-app
  fi
  pm2 restart enfa-quality-middleware || true

  sleep 3
  step "Health checks"
  curl -sS -o /dev/null -w 'app       : HTTP %{http_code}\n' http://127.0.0.1:3000/ || true
  curl -sS -o /dev/null -w 'middleware: HTTP %{http_code}\n' http://127.0.0.1:3005/health || true

  # Verify the login page can actually load its stylesheet and scripts.
  # This stops the deployment from reporting success when the page is
  # stuck on "Loading…" or unstyled because assets are 404.
  step "Verifying login page assets"
  verify_assets() {
    local base=$1
    local html
    html=$(curl -sS --max-time 10 "${base}/auth")
    if [[ -z "$html" ]]; then
      echo "ERROR: ${base}/auth returned empty HTML"; return 1
    fi
    local urls
    urls=$(printf '%s' "$html" | grep -oE '(/assets/[^"'\''<> ]+|/ramky-logo\.png|/favicon\.png|/manifest\.webmanifest|/icons/[^"'\''<> ]+)' | sort -u)
    if [[ -z "$urls" ]]; then
      echo "ERROR: no asset URLs found in ${base}/auth"; return 1
    fi
    local failed=0
    for u in $urls; do
      code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${base}${u}")
      if [[ "$code" != "200" ]]; then
        echo "ERROR: ${base}${u} returned HTTP ${code}"
        failed=1
      else
        echo "OK: ${base}${u}"
      fi
    done
    return $failed
  }
  if ! verify_assets "http://127.0.0.1:3000"; then
    echo "FATAL: login page assets are broken on the Node app (port 3000)."
    exit 1
  fi
  if ! verify_assets "http://127.0.0.1:8081"; then
    echo "FATAL: login page assets are broken through Nginx (port 8081)."
    exit 1
  fi
fi

step "Done"
echo "App     : http://10.200.1.7:8081"
echo "Supabase: http://10.200.1.7:8001    Studio: http://10.200.1.7:8082"
