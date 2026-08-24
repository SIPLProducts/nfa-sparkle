CREATE TABLE public.sap_attachment_job (
  cache_key text PRIMARY KEY,
  state text NOT NULL DEFAULT 'running',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sap_attachment_job TO service_role;
ALTER TABLE public.sap_attachment_job ENABLE ROW LEVEL SECURITY;