
DROP POLICY IF EXISTS "att insert by initiator" ON public.nfa_attachment;
CREATE POLICY "att insert by initiator" ON public.nfa_attachment
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id = nfa_attachment.nfa_id
      AND n.initiator_id = auth.uid()
      AND n.status IN ('with_initiator','clarification','rejected')
  )
);

DROP POLICY IF EXISTS "att delete by uploader" ON public.nfa_attachment;
CREATE POLICY "att delete by uploader" ON public.nfa_attachment
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id = nfa_attachment.nfa_id
      AND n.status IN ('with_initiator','clarification','rejected')
  )
);

DROP POLICY IF EXISTS "nfa-att insert" ON storage.objects;
CREATE POLICY "nfa-att insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'nfa-attachments'
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id::text = (storage.foldername(objects.name))[1]
      AND n.initiator_id = auth.uid()
      AND n.status IN ('with_initiator','clarification','rejected')
  )
);

DROP POLICY IF EXISTS "nfa-att delete" ON storage.objects;
CREATE POLICY "nfa-att delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'nfa-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.nfa n
    WHERE n.id::text = (storage.foldername(objects.name))[1]
      AND n.status IN ('with_initiator','clarification','rejected')
  )
);
