INSERT INTO public.sap_endpoint (name, description, module, path_or_url, http_method, auth_type, api_type, active, username, request_headers, request_query, request_body, system_id)
SELECT 'Approver Get Detail', 'Create NFA approvers for a plant (get_detail)', module,
       '/e-nfa/enfa_report//create?sap-client=300', 'GET', auth_type, api_type, true, username,
       request_headers, '{}'::jsonb, '{"get_detail":{"check":"","plant":""}}', system_id
FROM public.sap_endpoint
WHERE name = 'Approval Chain'
  AND NOT EXISTS (SELECT 1 FROM public.sap_endpoint WHERE name ilike 'Approver Get Detail')
ORDER BY created_at LIMIT 1;
