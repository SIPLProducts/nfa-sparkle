CREATE TABLE public.sap_attachment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enfa_number text NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime text,
  size bigint,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sap_attachment_enfa_idx ON public.sap_attachment (enfa_number);

GRANT SELECT, INSERT, DELETE ON public.sap_attachment TO authenticated;
GRANT ALL ON public.sap_attachment TO service_role;

ALTER TABLE public.sap_attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SAP attachments"
  ON public.sap_attachment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload SAP attachments"
  ON public.sap_attachment FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploader or admin can delete SAP attachments"
  ON public.sap_attachment FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));