CREATE TABLE public.enfa_working_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enfa_number text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  state text NOT NULL DEFAULT 'working' CHECK (state IN ('working', 'superseded', 'final')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enfa_number, version)
);
GRANT SELECT, INSERT, UPDATE ON public.enfa_working_document TO authenticated;
GRANT ALL ON public.enfa_working_document TO service_role;
ALTER TABLE public.enfa_working_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view working documents"
  ON public.enfa_working_document FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can create working documents"
  ON public.enfa_working_document FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update working documents"
  ON public.enfa_working_document FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER enfa_working_document_touch
  BEFORE UPDATE ON public.enfa_working_document
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX enfa_working_document_lookup_idx
  ON public.enfa_working_document (enfa_number, version DESC);
CREATE POLICY "Owners can read working document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'enfa-working-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Owners can upload working document files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'enfa-working-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Owners can update working document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'enfa-working-documents'
    AND owner_id = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'enfa-working-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );