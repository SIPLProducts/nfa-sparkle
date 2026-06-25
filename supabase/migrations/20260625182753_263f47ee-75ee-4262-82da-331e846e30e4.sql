
-- 1. Private schema + helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_nfa_approver(_nfa_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nfa_approver WHERE nfa_id = _nfa_id AND approver_id = _user_id)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_nfa_approver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_nfa_approver(uuid, uuid) TO authenticated, service_role;

-- 2. Recreate ALL policies that depend on public.has_role / public.is_nfa_approver
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "nfa: admin update" ON public.nfa;
CREATE POLICY "nfa: admin update" ON public.nfa FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "nfa: initiator/approver/admin/viewer read" ON public.nfa;
CREATE POLICY "nfa: initiator/approver/admin/viewer read" ON public.nfa FOR SELECT TO authenticated
  USING (
    initiator_id = auth.uid()
    OR private.is_nfa_approver(id, auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'viewer'::public.app_role)
  );

DROP POLICY IF EXISTS "approver rows: read" ON public.nfa_approver;
CREATE POLICY "approver rows: read" ON public.nfa_approver FOR SELECT TO authenticated
  USING (
    approver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_approver.nfa_id AND n.initiator_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'viewer'::public.app_role)
  );

DROP POLICY IF EXISTS "att read" ON public.nfa_attachment;
CREATE POLICY "att read" ON public.nfa_attachment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE n.id = nfa_attachment.nfa_id
        AND (
          n.initiator_id = auth.uid()
          OR private.is_nfa_approver(n.id, auth.uid())
          OR private.has_role(auth.uid(), 'admin'::public.app_role)
          OR private.has_role(auth.uid(), 'viewer'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "audit insert by participants" ON public.nfa_audit;
CREATE POLICY "audit insert by participants" ON public.nfa_audit FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE n.id = nfa_audit.nfa_id
        AND (n.initiator_id = auth.uid() OR private.is_nfa_approver(n.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "audit read" ON public.nfa_audit;
CREATE POLICY "audit read" ON public.nfa_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE n.id = nfa_audit.nfa_id
        AND (
          n.initiator_id = auth.uid()
          OR private.is_nfa_approver(n.id, auth.uid())
          OR private.has_role(auth.uid(), 'admin'::public.app_role)
          OR private.has_role(auth.uid(), 'viewer'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "view log read" ON public.nfa_attachment_view;
CREATE POLICY "view log read" ON public.nfa_attachment_view FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE n.id = nfa_attachment_view.nfa_id
        AND (
          n.initiator_id = auth.uid()
          OR private.is_nfa_approver(n.id, auth.uid())
          OR private.has_role(auth.uid(), 'admin'::public.app_role)
          OR private.has_role(auth.uid(), 'viewer'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "view log insert" ON public.nfa_attachment_view;
CREATE POLICY "view log insert" ON public.nfa_attachment_view FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE n.id = nfa_attachment_view.nfa_id
        AND (
          n.initiator_id = auth.uid()
          OR private.is_nfa_approver(n.id, auth.uid())
          OR private.has_role(auth.uid(), 'admin'::public.app_role)
          OR private.has_role(auth.uid(), 'viewer'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "nfa-att read" ON storage.objects;
CREATE POLICY "nfa-att read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'nfa-attachments'
    AND EXISTS (
      SELECT 1 FROM public.nfa n
      WHERE (n.id)::text = (storage.foldername(objects.name))[1]
        AND (
          n.initiator_id = auth.uid()
          OR private.is_nfa_approver(n.id, auth.uid())
          OR private.has_role(auth.uid(), 'admin'::public.app_role)
          OR private.has_role(auth.uid(), 'viewer'::public.app_role)
        )
    )
  );

-- 3. Drop now-unused public helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_nfa_approver(uuid, uuid);

-- 4. Profiles: restrict SELECT to own profile (admins still see all)
DROP POLICY IF EXISTS "profiles readable to authenticated" ON public.profiles;
CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles: admin read all" ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Safe directory view (id + full_name only, no email) for name lookups across the app
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = false) AS
  SELECT id, full_name FROM public.profiles;
GRANT SELECT ON public.profiles_directory TO authenticated;

-- 6. RPC to resolve approver user_ids by email for the NFA-creation chain
CREATE OR REPLACE FUNCTION public.resolve_users_by_email(_emails text[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE lower(p.email) = ANY (SELECT lower(e) FROM unnest(_emails) e)
$$;
REVOKE ALL ON FUNCTION public.resolve_users_by_email(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_users_by_email(text[]) TO authenticated;
