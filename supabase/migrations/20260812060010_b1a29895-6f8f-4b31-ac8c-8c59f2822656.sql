CREATE TABLE public.role_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  screen text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, screen)
);

GRANT SELECT ON public.role_permission TO authenticated;
GRANT ALL ON public.role_permission TO service_role;

ALTER TABLE public.role_permission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permission read" ON public.role_permission
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permission admin write" ON public.role_permission
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER role_permission_touch
  BEFORE UPDATE ON public.role_permission
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.role_permission (role, screen, allowed) VALUES
  ('initiator','dashboard',true),
  ('initiator','nfa_new',true),
  ('initiator','nfa_my',true),
  ('initiator','approvals',false),
  ('initiator','report',false),
  ('initiator','sap_api',false),
  ('initiator','user_management',false),
  ('approver','dashboard',true),
  ('approver','nfa_new',false),
  ('approver','nfa_my',true),
  ('approver','approvals',true),
  ('approver','report',false),
  ('approver','sap_api',false),
  ('approver','user_management',false),
  ('viewer','dashboard',true),
  ('viewer','nfa_new',false),
  ('viewer','nfa_my',false),
  ('viewer','approvals',false),
  ('viewer','report',true),
  ('viewer','sap_api',false),
  ('viewer','user_management',false),
  ('admin','dashboard',true),
  ('admin','nfa_new',true),
  ('admin','nfa_my',true),
  ('admin','approvals',true),
  ('admin','report',true),
  ('admin','sap_api',true),
  ('admin','user_management',true);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;