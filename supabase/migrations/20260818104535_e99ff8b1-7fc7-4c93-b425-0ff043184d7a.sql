DROP POLICY IF EXISTS "nfa-att insert" ON storage.objects;
CREATE POLICY "nfa-att insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'nfa-attachments'
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id::text = (storage.foldername(name))[1]
      AND (
        n.initiator_id = auth.uid()
        OR private.is_nfa_approver(n.id, auth.uid())
        OR private.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);