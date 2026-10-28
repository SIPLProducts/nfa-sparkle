-- Schema used by database webhooks / functions hooks.
CREATE SCHEMA IF NOT EXISTS supabase_functions;
ALTER SCHEMA supabase_functions OWNER TO supabase_admin;

GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

GRANT supabase_functions_admin TO postgres;
GRANT ALL ON SCHEMA supabase_functions TO supabase_functions_admin;
