REVOKE EXECUTE ON FUNCTION public.get_profiles_basic(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_users_by_email(text[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_basic(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_users_by_email(text[]) TO authenticated, service_role;