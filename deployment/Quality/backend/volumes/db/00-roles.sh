#!/usr/bin/env bash
# Synchronize the passwords of Supabase's built-in database roles with the
# Quality stack's POSTGRES_PASSWORD. This runs once for a fresh DB volume.
set -euo pipefail

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

psql \
  --username "${POSTGRES_USER:-postgres}" \
  --dbname "${POSTGRES_DB:-postgres}" \
  --set=ON_ERROR_STOP=1 \
  --set=role_password="$POSTGRES_PASSWORD" <<'EOSQL'
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
EOSQL