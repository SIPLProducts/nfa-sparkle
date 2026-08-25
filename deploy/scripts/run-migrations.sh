#!/usr/bin/env bash
# eNFA QUALITY - apply all SQL migrations to the self-hosted Supabase database.
#
# Idempotent: every applied file is recorded in public.schema_migrations_applied,
# so re-running only applies what is new.
#
# Usage:
#   cd /opt/enfa/app
#   PGPASSWORD='<POSTGRES_PASSWORD>' ./deploy/scripts/run-migrations.sh
#
# Optional env:
#   PGHOST (default 127.0.0.1)  PGPORT (54322) PGUSER (postgres)  PGDATABASE (postgres)
#   MIGRATIONS_DIR (default <repo>/supabase/migrations)
#   DRY_RUN=1   -> only list what would be applied

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-54322}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  read -rsp "Postgres password for $PGUSER@$PGHOST:$PGPORT: " PGPASSWORD
  echo
  export PGPASSWORD
fi

command -v psql >/dev/null || { echo "psql not found. sudo apt install -y postgresql-client"; exit 1; }
[[ -d "$MIGRATIONS_DIR" ]] || { echo "No migrations directory at $MIGRATIONS_DIR"; exit 1; }

psql -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS public.schema_migrations_applied (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );" >/dev/null

echo "Database : $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
echo "Migrations: $MIGRATIONS_DIR"
echo

applied=0
skipped=0
failed=""

shopt -s nullglob
for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
  name="$(basename "$file")"

  already="$(psql -tAq -c "SELECT 1 FROM public.schema_migrations_applied WHERE filename = '$name'")"
  if [[ "$already" == "1" ]]; then
    printf '  skip   %s\n' "$name"
    skipped=$((skipped + 1))
    continue
  fi

  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    printf '  would  %s\n' "$name"
    applied=$((applied + 1))
    continue
  fi

  printf '  apply  %s ... ' "$name"
  if psql -v ON_ERROR_STOP=1 -q --single-transaction -f "$file" >/tmp/enfa-migrate.log 2>&1; then
    psql -v ON_ERROR_STOP=1 -q -c \
      "INSERT INTO public.schema_migrations_applied(filename) VALUES ('$name')
       ON CONFLICT (filename) DO NOTHING;" >/dev/null
    echo "ok"
    applied=$((applied + 1))
  else
    echo "FAILED"
    echo "-------------------------------------------------------------"
    cat /tmp/enfa-migrate.log
    echo "-------------------------------------------------------------"
    failed="$name"
    break
  fi
done

echo
echo "applied: $applied   skipped: $skipped"

if [[ -n "$failed" ]]; then
  echo "Stopped at $failed. Fix the error above and re-run - completed files are not re-applied."
  exit 1
fi

echo "Schema is up to date."
echo "Next: create the admin login in Studio, then run deploy/scripts/seed-admin.sql"
