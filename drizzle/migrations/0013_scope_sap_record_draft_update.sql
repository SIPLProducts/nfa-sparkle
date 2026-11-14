CREATE OR REPLACE FUNCTION private.can_edit_sap_draft(_enfa text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sap_record_draft d
    WHERE d.enfa_number = _enfa AND (
      d.updated_by = auth.uid() OR d.initiator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.profiles p, jsonb_array_elements(CASE WHEN jsonb_typeof(d.approvers) = 'array' THEN d.approvers ELSE '[]'::jsonb END) a
        WHERE p.id = auth.uid() AND p.username IS NOT NULL
          AND lower(btrim(a->>'userId')) = lower(btrim(p.username))
      )
    )
  )
$$;
REVOKE ALL ON FUNCTION private.can_edit_sap_draft(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_edit_sap_draft(text) TO authenticated;
DROP POLICY IF EXISTS "Authenticated users can update SAP record edits" ON public.sap_record_draft;
CREATE POLICY "Participants can update SAP record edits" ON public.sap_record_draft FOR UPDATE TO authenticated
USING (private.can_edit_sap_draft(enfa_number)) WITH CHECK (updated_by = auth.uid());