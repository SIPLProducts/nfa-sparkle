CREATE TABLE public.approval_chain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_chain TO authenticated;
GRANT ALL ON public.approval_chain TO service_role;
ALTER TABLE public.approval_chain ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage approval chains" ON public.approval_chain
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER approval_chain_touch BEFORE UPDATE ON public.approval_chain
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.approval_chain_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.approval_chain(id) ON DELETE CASCADE,
  level integer NOT NULL,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, level)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_chain_level TO authenticated;
GRANT ALL ON public.approval_chain_level TO service_role;
ALTER TABLE public.approval_chain_level ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage approval chain levels" ON public.approval_chain_level
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));