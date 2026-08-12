CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = _role
  ) OR EXISTS (
    SELECT 1 FROM public.user_role_assignment ura
    WHERE ura.user_id = _user_id AND ura.role_key = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;