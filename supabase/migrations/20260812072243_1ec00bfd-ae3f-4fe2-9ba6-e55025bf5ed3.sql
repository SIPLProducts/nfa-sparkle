CREATE TABLE public.sap_system (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'DEV',
  protocol text NOT NULL DEFAULT 'http',
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 8000,
  sap_client text NOT NULL DEFAULT '',
  base_path text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  route_via_middleware boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sap_system TO authenticated;
GRANT ALL ON public.sap_system TO service_role;

ALTER TABLE public.sap_system ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sap_system admin all" ON public.sap_system
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER sap_system_touch BEFORE UPDATE ON public.sap_system
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE UNIQUE INDEX sap_system_single_active ON public.sap_system (is_active) WHERE is_active;

ALTER TABLE public.sap_endpoint ADD COLUMN system_id uuid REFERENCES public.sap_system(id) ON DELETE SET NULL;

INSERT INTO public.sap_system (key, label, environment, protocol, host, port, sap_client, base_path, username, is_active)
SELECT
  COALESCE(NULLIF(c.environment, ''), 'DEV'),
  'Migrated from SAP Connection',
  COALESCE(NULLIF(c.environment, ''), 'DEV'),
  CASE WHEN c.base_url ILIKE 'https://%' THEN 'https' ELSE 'http' END,
  COALESCE(NULLIF(split_part(regexp_replace(regexp_replace(c.base_url, '^https?://', ''), '/.*$', ''), ':', 1), ''), ''),
  COALESCE(NULLIF(split_part(regexp_replace(regexp_replace(c.base_url, '^https?://', ''), '/.*$', ''), ':', 2), '')::int, 8000),
  '',
  '',
  COALESCE(c.username, ''),
  true
FROM public.sap_connection c
WHERE c.base_url <> ''
  AND NOT EXISTS (SELECT 1 FROM public.sap_system)
LIMIT 1;