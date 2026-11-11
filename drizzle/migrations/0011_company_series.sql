CREATE TABLE public.company_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series text NOT NULL UNIQUE,
  range_from integer NOT NULL,
  range_to integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_series TO authenticated;
GRANT ALL ON public.company_series TO service_role;
ALTER TABLE public.company_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read series" ON public.company_series FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.validate_company_series()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.range_from > NEW.range_to THEN RAISE EXCEPTION 'From must not be greater than To'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER company_series_validate BEFORE INSERT OR UPDATE ON public.company_series
FOR EACH ROW EXECUTE FUNCTION public.validate_company_series();
ALTER TABLE public.profiles ADD COLUMN company_series text;