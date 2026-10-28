CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  enfa_no text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  people text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  error text
);
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON public.email_log (created_at DESC);