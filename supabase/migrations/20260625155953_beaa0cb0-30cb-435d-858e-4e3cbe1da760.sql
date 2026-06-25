
-- Enums
CREATE TYPE public.app_role AS ENUM ('initiator','approver','admin','viewer');
CREATE TYPE public.nfa_status AS ENUM ('with_initiator','in_process','clarification','completed','rejected');
CREATE TYPE public.approver_status AS ENUM ('pending','approved','rejected','sent_back','clarification');

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- profiles (display name lookup for Approver1..6 columns)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable to authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create profile + default initiator role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'initiator') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ENFA number sequence
CREATE SEQUENCE public.enfa_seq START 100000;

-- nfa
CREATE TABLE public.nfa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enfa_number TEXT NOT NULL UNIQUE DEFAULT nextval('public.enfa_seq')::text,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  plant TEXT,
  plant_name TEXT,
  project TEXT,
  nfa_type TEXT NOT NULL,
  function TEXT,
  subject TEXT NOT NULL,
  scope_impact TEXT,
  budget_impact NUMERIC,
  timeline_days INTEGER,
  detailed_description TEXT,
  status nfa_status NOT NULL DEFAULT 'with_initiator',
  current_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfa TO authenticated;
GRANT ALL ON public.nfa TO service_role;
ALTER TABLE public.nfa ENABLE ROW LEVEL SECURITY;

-- nfa_approver
CREATE TABLE public.nfa_approver (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfa_id UUID NOT NULL REFERENCES public.nfa(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation TEXT,
  status approver_status NOT NULL DEFAULT 'pending',
  comment TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(nfa_id, level)
);
CREATE INDEX ON public.nfa_approver(nfa_id);
CREATE INDEX ON public.nfa_approver(approver_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfa_approver TO authenticated;
GRANT ALL ON public.nfa_approver TO service_role;
ALTER TABLE public.nfa_approver ENABLE ROW LEVEL SECURITY;

-- nfa_attachment
CREATE TABLE public.nfa_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfa_id UUID NOT NULL REFERENCES public.nfa(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  size BIGINT,
  mime TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.nfa_attachment(nfa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfa_attachment TO authenticated;
GRANT ALL ON public.nfa_attachment TO service_role;
ALTER TABLE public.nfa_attachment ENABLE ROW LEVEL SECURITY;

-- nfa_audit
CREATE TABLE public.nfa_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfa_id UUID NOT NULL REFERENCES public.nfa(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  comment TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.nfa_audit(nfa_id);
GRANT SELECT, INSERT ON public.nfa_audit TO authenticated;
GRANT ALL ON public.nfa_audit TO service_role;
ALTER TABLE public.nfa_audit ENABLE ROW LEVEL SECURITY;

-- Helper: is the user an approver on this NFA?
CREATE OR REPLACE FUNCTION public.is_nfa_approver(_nfa_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nfa_approver WHERE nfa_id = _nfa_id AND approver_id = _user_id)
$$;

-- NFA RLS
CREATE POLICY "nfa: initiator/approver/admin/viewer read" ON public.nfa FOR SELECT TO authenticated USING (
  initiator_id = auth.uid()
  OR public.is_nfa_approver(id, auth.uid())
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'viewer')
);
CREATE POLICY "nfa: initiator insert" ON public.nfa FOR INSERT TO authenticated
  WITH CHECK (initiator_id = auth.uid());
CREATE POLICY "nfa: initiator update while editable" ON public.nfa FOR UPDATE TO authenticated
  USING (initiator_id = auth.uid() AND status IN ('with_initiator','clarification'))
  WITH CHECK (initiator_id = auth.uid());
CREATE POLICY "nfa: admin update" ON public.nfa FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "nfa: initiator delete drafts" ON public.nfa FOR DELETE TO authenticated
  USING (initiator_id = auth.uid() AND status = 'with_initiator');

-- nfa_approver RLS
CREATE POLICY "approver rows: read" ON public.nfa_approver FOR SELECT TO authenticated USING (
  approver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND n.initiator_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'viewer')
);
CREATE POLICY "approver rows: initiator inserts chain" ON public.nfa_approver FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND n.initiator_id = auth.uid()));
CREATE POLICY "approver rows: initiator can clear chain while editable" ON public.nfa_approver FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND n.initiator_id = auth.uid() AND n.status IN ('with_initiator','clarification')));
CREATE POLICY "approver rows: approver acts on own row" ON public.nfa_approver FOR UPDATE TO authenticated
  USING (approver_id = auth.uid()) WITH CHECK (approver_id = auth.uid());

-- attachments RLS
CREATE POLICY "att read" ON public.nfa_attachment FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND (
    n.initiator_id = auth.uid()
    OR public.is_nfa_approver(n.id, auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'viewer')
  ))
);
CREATE POLICY "att insert by initiator" ON public.nfa_attachment FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND n.initiator_id = auth.uid())
);
CREATE POLICY "att delete by uploader" ON public.nfa_attachment FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- audit RLS
CREATE POLICY "audit read" ON public.nfa_audit FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND (
    n.initiator_id = auth.uid()
    OR public.is_nfa_approver(n.id, auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'viewer')
  ))
);
CREATE POLICY "audit insert by participants" ON public.nfa_audit FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.nfa n WHERE n.id = nfa_id AND (
    n.initiator_id = auth.uid() OR public.is_nfa_approver(n.id, auth.uid())
  ))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER nfa_touch BEFORE UPDATE ON public.nfa FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
