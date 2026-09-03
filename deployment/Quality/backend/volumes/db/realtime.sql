-- Schema used by the Realtime service.
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO postgres;
GRANT ALL ON SCHEMA _realtime TO supabase_admin;
