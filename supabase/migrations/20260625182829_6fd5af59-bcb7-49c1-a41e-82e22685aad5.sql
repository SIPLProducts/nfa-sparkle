
DROP VIEW IF EXISTS public.profiles_directory;

CREATE OR REPLACE FUNCTION public.get_profiles_basic(_ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = ANY (_ids)
$$;
REVOKE ALL ON FUNCTION public.get_profiles_basic(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_basic(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_users_by_email(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_users_by_email(text[]) TO authenticated;
