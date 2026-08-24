CREATE TABLE public.sap_attachment_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  status integer,
  latency_ms integer,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.sap_attachment_cache TO service_role;
ALTER TABLE public.sap_attachment_cache ENABLE ROW LEVEL SECURITY;