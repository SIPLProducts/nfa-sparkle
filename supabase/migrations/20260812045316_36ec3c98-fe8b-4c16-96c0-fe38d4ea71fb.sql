DROP TABLE IF EXISTS private.sap_secret;

CREATE TABLE public.sap_secret (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sap_secret FROM anon, authenticated;
GRANT ALL ON public.sap_secret TO service_role;
ALTER TABLE public.sap_secret ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can touch this table.