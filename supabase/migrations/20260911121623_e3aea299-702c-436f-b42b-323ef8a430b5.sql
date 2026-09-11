DROP POLICY IF EXISTS "Owners can view working documents" ON public.enfa_working_document;
CREATE POLICY "Workflow participants can view documents"
  ON public.enfa_working_document FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.nfa n
      WHERE n.enfa_number = enfa_working_document.enfa_number
        AND (
          n.initiator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.nfa_approver na
            WHERE na.nfa_id = n.id AND na.approver_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Owners can read working document files" ON storage.objects;
CREATE POLICY "Workflow participants can read document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'enfa-working-documents'
    AND EXISTS (
      SELECT 1
      FROM public.enfa_working_document d
      WHERE d.storage_path = name
        AND (
          d.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR EXISTS (
            SELECT 1
            FROM public.nfa n
            WHERE n.enfa_number = d.enfa_number
              AND (
                n.initiator_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.nfa_approver na
                  WHERE na.nfa_id = n.id AND na.approver_id = auth.uid()
                )
              )
          )
        )
    )
  );