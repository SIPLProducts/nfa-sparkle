-- Server-only secret store (private schema, service_role only)
CREATE TABLE IF NOT EXISTS private.sap_secret (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.sap_secret FROM anon, authenticated;
GRANT ALL ON private.sap_secret TO service_role;

-- SAP connection (single row)
CREATE TABLE public.sap_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'DEV',
  base_url text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sap_connection TO authenticated;
GRANT ALL ON public.sap_connection TO service_role;
ALTER TABLE public.sap_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sap_connection admin all" ON public.sap_connection FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Middleware config (single row)
CREATE TABLE public.sap_middleware_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_mode text NOT NULL DEFAULT 'proxy',
  deployment_mode text NOT NULL DEFAULT 'lovable_cloud',
  port integer NOT NULL DEFAULT 3005,
  url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sap_middleware_config TO authenticated;
GRANT ALL ON public.sap_middleware_config TO service_role;
ALTER TABLE public.sap_middleware_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sap_middleware admin all" ON public.sap_middleware_config FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Endpoints
CREATE TABLE public.sap_endpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  module text NOT NULL DEFAULT 'Common',
  path_or_url text NOT NULL DEFAULT '',
  http_method text NOT NULL DEFAULT 'POST',
  auth_type text NOT NULL DEFAULT 'basic',
  api_type text NOT NULL DEFAULT 'fetch',
  active boolean NOT NULL DEFAULT true,
  username text,
  request_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_body text,
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_cron text,
  last_test_at timestamptz,
  last_test_status integer,
  last_test_ok boolean,
  last_test_ms integer,
  last_test_body text,
  last_test_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sap_endpoint TO authenticated;
GRANT ALL ON public.sap_endpoint TO service_role;
ALTER TABLE public.sap_endpoint ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sap_endpoint admin all" ON public.sap_endpoint FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Test log
CREATE TABLE public.sap_test_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.sap_endpoint(id) ON DELETE CASCADE,
  target text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  status integer,
  latency_ms integer,
  message text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sap_test_log TO authenticated;
GRANT ALL ON public.sap_test_log TO service_role;
ALTER TABLE public.sap_test_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sap_test_log admin all" ON public.sap_test_log FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER sap_connection_touch BEFORE UPDATE ON public.sap_connection
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sap_middleware_touch BEFORE UPDATE ON public.sap_middleware_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sap_endpoint_touch BEFORE UPDATE ON public.sap_endpoint
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.sap_connection (environment, base_url, username) VALUES ('DEV', '', '');
INSERT INTO public.sap_middleware_config (connection_mode, deployment_mode, port, url) VALUES ('proxy', 'lovable_cloud', 3005, '');