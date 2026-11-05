INSERT INTO public.sap_endpoint (name, description, module, path_or_url, http_method, auth_type, api_type, active, username, request_headers, request_query, request_body, system_id)
SELECT 'Dynamic Approvers', 'Create NFA dynamic approvers for all plants of the selected company', p.module, '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'POST', p.auth_type, p.api_type, true, p.username, p.request_headers, p.request_query,
'{"approvers":{"check":"","plant":[{"plant":"9000"}]}}', p.system_id
FROM public.sap_endpoint p
WHERE p.name = 'Plant F4'
  AND NOT EXISTS (SELECT 1 FROM public.sap_endpoint WHERE name ILIKE 'Dynamic Approvers')
LIMIT 1;