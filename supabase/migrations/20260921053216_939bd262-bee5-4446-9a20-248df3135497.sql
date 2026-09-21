INSERT INTO public.sap_endpoint (
  name, description, module, path_or_url, http_method, auth_type, api_type, active,
  request_headers, request_query, request_body
)
SELECT
  'Approval flow in Detailed Description',
  'Loads the approval flow for the selected Plant, NFA Type, and Function.',
  'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true,
  '{}'::jsonb, '{}'::jsonb,
  '{"get_data":{"plant":"","nfa_type":"","funct":""}}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.sap_endpoint WHERE lower(name) = lower('Approval flow in Detailed Description')
);

INSERT INTO public.sap_endpoint (
  name, description, module, path_or_url, http_method, auth_type, api_type, active,
  request_headers, request_query, request_body
)
SELECT
  'Logo in Detailed Description',
  'Loads the company logo for the selected Company Code.',
  'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true,
  '{}'::jsonb, '{}'::jsonb,
  '{"logo":{"cc_code":""}}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.sap_endpoint WHERE lower(name) = lower('Logo in Detailed Description')
);