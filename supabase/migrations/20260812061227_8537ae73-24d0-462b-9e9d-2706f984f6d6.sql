CREATE TABLE public.app_role_def (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_role_def TO authenticated;
GRANT ALL ON public.app_role_def TO service_role;
ALTER TABLE public.app_role_def ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role defs readable" ON public.app_role_def FOR SELECT TO authenticated USING (true);
CREATE POLICY "role defs admin write" ON public.app_role_def FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER app_role_def_touch BEFORE UPDATE ON public.app_role_def
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_role_def(key, name, description, is_system) VALUES
  ('initiator','Initiator','Can create and submit NFAs',true),
  ('approver','Approver','Can act on NFAs assigned to them',true),
  ('admin','Admin','Full administrative access',true),
  ('viewer','Viewer','Read-only access to NFA reports',true);

CREATE TABLE public.user_role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_key text NOT NULL REFERENCES public.app_role_def(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);
GRANT SELECT ON public.user_role_assignment TO authenticated;
GRANT ALL ON public.user_role_assignment TO service_role;
ALTER TABLE public.user_role_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read assignments" ON public.user_role_assignment FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin write assignments" ON public.user_role_assignment FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.role_permission ADD COLUMN IF NOT EXISTS role_key text;
UPDATE public.role_permission SET role_key = role::text WHERE role_key IS NULL;
ALTER TABLE public.role_permission ALTER COLUMN role DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_permission_role_key_screen_idx
  ON public.role_permission (role_key, screen);