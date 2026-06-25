
CREATE TABLE public.nfa_attachment_view (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfa_id uuid NOT NULL REFERENCES public.nfa(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES public.nfa_attachment(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('view','download')),
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nfa_attachment_view_nfa_idx ON public.nfa_attachment_view(nfa_id, viewed_at DESC);

GRANT SELECT, INSERT ON public.nfa_attachment_view TO authenticated;
GRANT ALL ON public.nfa_attachment_view TO service_role;

ALTER TABLE public.nfa_attachment_view ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view log read"
ON public.nfa_attachment_view FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id = nfa_attachment_view.nfa_id
      AND (
        n.initiator_id = auth.uid()
        OR public.is_nfa_approver(n.id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'viewer'::public.app_role)
      )
  )
);

CREATE POLICY "view log insert"
ON public.nfa_attachment_view FOR INSERT TO authenticated
WITH CHECK (
  viewer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id = nfa_attachment_view.nfa_id
      AND (
        n.initiator_id = auth.uid()
        OR public.is_nfa_approver(n.id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'viewer'::public.app_role)
      )
  )
);
