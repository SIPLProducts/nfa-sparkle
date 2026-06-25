
-- Path convention: {nfa_id}/{filename}
CREATE POLICY "nfa-att read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'nfa-attachments' AND EXISTS (
    SELECT 1 FROM public.nfa n WHERE n.id::text = (storage.foldername(name))[1]
    AND (n.initiator_id = auth.uid()
         OR public.is_nfa_approver(n.id, auth.uid())
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'viewer'))
  )
);
CREATE POLICY "nfa-att insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'nfa-attachments' AND EXISTS (
    SELECT 1 FROM public.nfa n WHERE n.id::text = (storage.foldername(name))[1]
    AND n.initiator_id = auth.uid()
  )
);
CREATE POLICY "nfa-att delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'nfa-attachments' AND owner = auth.uid()
);
