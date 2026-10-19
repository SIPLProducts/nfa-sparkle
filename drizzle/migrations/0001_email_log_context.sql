ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS level integer;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS source text;