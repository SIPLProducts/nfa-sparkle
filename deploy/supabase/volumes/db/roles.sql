-- Set passwords for the internal Supabase roles from POSTGRES_PASSWORD.
-- Runs once, only on a freshly initialised data directory.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator            WITH PASSWORD :'pgpass';
ALTER USER pgbouncer                WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin      WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin   WITH PASSWORD :'pgpass';
ALTER USER supabase_admin           WITH PASSWORD :'pgpass';
ALTER USER supabase_read_only_user  WITH PASSWORD :'pgpass';
