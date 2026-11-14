DROP POLICY IF EXISTS "role defs readable" ON public.app_role_def;
CREATE POLICY "role defs admin read" ON public.app_role_def FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Signed-in users read series" ON public.company_series;
DROP POLICY IF EXISTS "Authenticated can read companies" ON public.companies;
DROP POLICY IF EXISTS "role_permission read" ON public.role_permission;
CREATE POLICY "role_permission own roles read" ON public.role_permission FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_role_assignment a WHERE a.user_id = auth.uid() AND a.role_key = role_permission.role_key));
DROP POLICY IF EXISTS "Authenticated users can view SAP attachments" ON public.sap_attachment;
CREATE POLICY "Uploader or admin can view SAP attachments" ON public.sap_attachment FOR SELECT TO authenticated
USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "sap-att read" ON storage.objects;
CREATE POLICY "sap-att read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'nfa-attachments' AND (storage.foldername(name))[1] = 'sap' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));