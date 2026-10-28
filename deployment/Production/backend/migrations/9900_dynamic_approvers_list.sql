-- Registers the "Dynamic Approvers List" SAP endpoint (User Management → Dynamic Approvers).
-- Copies system/login from the existing "Dynamic Approvals" (or "Approval Chain") entry. Rerunnable.
INSERT INTO public.sap_endpoint (name, description, module, path_or_url, http_method, auth_type, api_type, active, username, request_headers, request_query, request_body, system_id)
SELECT 'Dynamic Approvers List', 'Dynamic approvers saved per NFA (blank = all)', module,
       path_or_url, 'GET', auth_type, api_type, true, username,
       request_headers, request_query, '{"dynamic_approvers":""}', system_id
FROM public.sap_endpoint
WHERE name ilike ANY (ARRAY['Dynamic Approvals','Approver Get Detail','Approval Chain'])
  AND NOT EXISTS (SELECT 1 FROM public.sap_endpoint WHERE name ilike 'Dynamic Approvers List')
ORDER BY (name ilike 'Dynamic Approvals') DESC, created_at
LIMIT 1;

-- Keep the Create NFA approver lookup template on get_detail.
UPDATE public.sap_endpoint
   SET request_body = '{"get_detail":{"check":"","plant":"","nfa_type":"","funct":""}}'
 WHERE name ilike 'Dynamic Approvals' AND request_body ilike '%dynamic_approvers%';
