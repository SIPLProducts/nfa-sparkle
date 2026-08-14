CREATE TABLE public.sap_record_draft (
  enfa_number text NOT NULL PRIMARY KEY,
  subject text,
  scope_impact text,
  budget_impact numeric,
  timeline_days integer,
  detailed_description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sap_record_draft TO authenticated;
GRANT ALL ON public.sap_record_draft TO service_role;

ALTER TABLE public.sap_record_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SAP record edits"
  ON public.sap_record_draft FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create SAP record edits"
  ON public.sap_record_draft FOR INSERT TO authenticated WITH CHECK (updated_by = auth.uid());
CREATE POLICY "Authenticated users can update SAP record edits"
  ON public.sap_record_draft FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = auth.uid());

CREATE TRIGGER sap_record_draft_touch BEFORE UPDATE ON public.sap_record_draft
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "sap-att read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nfa-attachments' AND (storage.foldername(name))[1] = 'sap');

CREATE POLICY "sap-att insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfa-attachments' AND (storage.foldername(name))[1] = 'sap');

CREATE POLICY "sap-att delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nfa-attachments' AND (storage.foldername(name))[1] = 'sap' AND owner = auth.uid());