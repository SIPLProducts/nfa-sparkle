INSERT INTO public.sap_endpoint (
  name, description, module, path_or_url, http_method, auth_type, api_type, active,
  request_headers, request_query, request_body, schedule_enabled, system_id
)
SELECT
  'Create ENFA',
  'Submits a new eNFA to SAP and returns the generated ENFA number.',
  'Common',
  '/e-nfa/enfa_report/create',
  'POST',
  'basic',
  'push',
  true,
  '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
  '{}'::jsonb,
  '{"create":{"CC_code":"","PSPNR":"","NAME1":"","FUNCT":"","EXTR_TXT":"","SUBJECT":"","SCOPE_IMPACT":"","BUDGET_IMPACT":"","TIMELINE_IMPACT":"","TEXT":"","file":[{"file_name":"","file":""}]}}',
  false,
  (SELECT id FROM public.sap_system WHERE is_active ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sap_endpoint WHERE name ILIKE '%create%' OR path_or_url ILIKE '%enfa_report/create%'
);