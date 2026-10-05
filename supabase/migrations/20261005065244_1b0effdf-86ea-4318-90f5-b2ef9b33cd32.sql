CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.user_role_assignment ura
    WHERE ura.user_id = _user_id
      AND ura.role_key IN (
        _role,
        CASE _role
          WHEN 'admin' THEN 'custom_admin'
          WHEN 'approver' THEN 'custom_approver'
          WHEN 'initiator' THEN 'custom_initiator'
          WHEN 'viewer' THEN 'custom_viewer'
          ELSE _role
        END
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.user_role_assignment ura
    WHERE ura.user_id = _user_id
      AND ura.role_key = ('custom_' || _role::text)
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_role_assignment(user_id,role_key)
    VALUES (NEW.id,'custom_initiator') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;