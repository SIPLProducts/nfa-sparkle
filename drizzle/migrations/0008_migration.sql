ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_name_lower_key;
DROP INDEX IF EXISTS public.companies_name_lower_key;
CREATE UNIQUE INDEX IF NOT EXISTS companies_name_code_key ON public.companies (lower(name), coalesce(code, ''));
UPDATE public.companies
SET name = btrim(regexp_replace(name, '^\s*' || code || '\s*[–-]\s*', ''))
WHERE code IS NOT NULL AND name ~ ('^\s*' || code || '\s*[–-]');