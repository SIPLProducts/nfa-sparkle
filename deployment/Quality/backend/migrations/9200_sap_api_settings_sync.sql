-- Quality SAP API Settings synchronization.
-- Safe to re-run: updates matching endpoint names and inserts only missing rows.
-- Existing SAP systems, credentials, secrets, users, roles, NFAs and attachments
-- are not deleted or replaced.

BEGIN;

CREATE TEMP TABLE quality_sap_endpoint_sync (
  name text PRIMARY KEY,
  description text,
  module text NOT NULL,
  path_or_url text NOT NULL,
  http_method text NOT NULL,
  auth_type text NOT NULL,
  api_type text NOT NULL,
  active boolean NOT NULL,
  request_headers jsonb NOT NULL,
  request_query jsonb NOT NULL,
  request_body text
) ON COMMIT DROP;

INSERT INTO quality_sap_endpoint_sync
  (name, description, module, path_or_url, http_method, auth_type, api_type, active, request_headers, request_query, request_body)
VALUES
  ('eNFA Report', 'SAP eNFA report feed used by the Reports screen', 'Common', '/e-nfa/enfa_report/create', 'PUT', 'basic', 'fetch', true, '{"Accept":"application/json","Content-Type":"application/json"}', '{}', '{"report":{"user_name":"","plant_from":"","plant_to":"","funct_from":"","funct_to":"","nfano_from":"","nfano_to":"","extra_from":"","extra_to":"","dat_from":"","dat_to":"","usrid_from":"","usrid_to":"","r_proc":"","r_comp":"","r_reje":"","r_init":"","r_clar":""}}'),
  ('Get  ENFA  Number Deatils', 'Loads one eNFA record by reference number', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"edit":{"user_name":"","reffld":""}}'),
  ('Change Report', 'Updates an existing eNFA record', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"submit":{"reffld":"","CC_TEXT":"","PSPNR":"","NAME1":"","FUNCT":"","EXTR_TXT":"","SUBJECT":"","SCOPE_IMPACT":"","BUDGET_IMPACT":"","TIMELINE_IMPACT":"","TEXT":""}}'),
  ('Create ENFA', 'Submits a new eNFA to SAP and returns the generated eNFA number', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"create":{"user_name":"","CC_code":"","PSPNR":"","NAME1":"","FUNCT":"","EXTR_TXT":"","SUBJECT":"","SCOPE_IMPACT":"","BUDGET_IMPACT":"","TIMELINE_IMPACT":"","TEXT":"","file":[]}}'),
  ('Company F4', 'SAP value help for the Company field on Create eNFA', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"cc_code":""}'),
  ('Plant F4', 'SAP value help for Plant', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"plant":{"bukrs":""}}'),
  ('ENFA Type F4', 'SAP value help for eNFA Type', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"type":{"nfa_typ":""}}'),
  ('Function F4', 'SAP value help for Function', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"FUNC":{"nfa_typ1":""}}'),
  ('Preview Button', 'Loads the SAP Print Form preview from Reports', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"PRINT":{"EFNA_NO":""}}'),
  ('Attachments IN Reports', 'Loads SAP attachments from Reports', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"attachment":{"reffld":""}}'),
  ('Upload Document', 'Uploads documents to an eNFA from Reports', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"upload":{"user_name":"","reffld":"","file":[]}}'),
  ('Display Edit Data', 'Loads the current user eNFA list for editing', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"report":{"user_name":""}}'),
  ('MY NFA Select', 'Loads a selected My NFA record', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"edit":{"reffld":""}}'),
  ('Edit IN My NFA', 'Saves edits to a My NFA record', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"submit":{"reffld":"","CC_TEXT":"","PSPNR":"","NAME1":"","FUNCT":"","EXTR_TXT":"","SUBJECT":"","SCOPE_IMPACT":"","BUDGET_IMPACT":"","TIMELINE_IMPACT":"","TEXT":""}}'),
  ('Preview In Edit', 'Loads the SAP Print Form preview from My NFAs', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"PRINT":{"EFNA_NO":""}}'),
  ('Attachments In My NFA', 'Loads SAP attachments from My NFAs', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"attachment":{"reffld":""}}'),
  ('Attached Docs In MY NFA', 'Uploads documents from My NFAs', 'Common', '/e-nfa/enfa_report/create?sap-client=300', 'POST', 'basic', 'fetch', true, '{}', '{}', '{"upload":{"user_name":"","reffld":"","file":[]}}'),
  ('Approval Get Data', 'Loads the eNFA approval worklist', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"get_data":{"user_name":""}}'),
  ('Approved Button', 'Submits an approval and the final PDF when applicable', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"approve":{"user_name":"","REFFLD":"","Comment":"","file_path":"","file":""}}'),
  ('Reject Button', 'Submits a rejection with the current Print Form PDF', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"reject":{"user_name":"","REFFLD":"","Comment":"","file_path":"","file":""}}'),
  ('Back To Intiator', 'Returns an eNFA to its initiator', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"INITIATOR":{"user_name":"","REFFLD":"","Comment":""}}'),
  ('Clarification Button', 'Requests clarification for an eNFA', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'PUT', 'basic', 'fetch', true, '{}', '{}', '{"clarification":{"user_name":"","REFFLD":"","Comment":""}}'),
  ('Approval Chain', 'Loads the configured SAP approval chain', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"approver":""}'),
  ('Logo in Detailed Description', 'Loads the company logo for the selected Company Code', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"logo":{"cc_code":""}}'),
  ('Approval flow in Detailed Description', 'Loads the approval flow for the selected Plant, NFA Type, and Function', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"get_data":{"plant":"","nfa_type":"","funct":""}}'),
  ('Comments_in_Printform', 'Loads saved comments version-wise for the Print Form', 'Common', '/e-nfa/enfa_approval/APPROVAL?sap-client=300', 'GET', 'basic', 'fetch', true, '{}', '{}', '{"comment":{"Reffld":""}}');

-- Normalize accidental duplicate names first, retaining the oldest configured row.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(btrim(name)) ORDER BY created_at, id) AS position
  FROM public.sap_endpoint
)
UPDATE public.sap_endpoint ep
SET active = false,
    updated_at = now()
FROM ranked r
WHERE ep.id = r.id
  AND r.position > 1;

-- Update endpoint behavior while preserving row IDs, endpoint usernames,
-- assigned SAP systems, test history and separately stored passwords.
UPDATE public.sap_endpoint ep
SET name = source.name,
    description = source.description,
    module = source.module,
    path_or_url = source.path_or_url,
    http_method = source.http_method,
    auth_type = source.auth_type,
    api_type = source.api_type,
    active = source.active,
    request_headers = source.request_headers,
    request_query = source.request_query,
    request_body = source.request_body,
    updated_at = now()
FROM quality_sap_endpoint_sync source
WHERE lower(btrim(ep.name)) = lower(btrim(source.name))
  AND ep.id = (
    SELECT existing.id
    FROM public.sap_endpoint existing
    WHERE lower(btrim(existing.name)) = lower(btrim(source.name))
    ORDER BY existing.created_at, existing.id
    LIMIT 1
  );

-- New rows inherit the currently active SAP system. Credentials remain in the
-- existing system/secret records and are never copied into this migration.
INSERT INTO public.sap_endpoint (
  name, description, module, path_or_url, http_method, auth_type, api_type,
  active, request_headers, request_query, request_body, system_id
)
SELECT
  source.name, source.description, source.module, source.path_or_url,
  source.http_method, source.auth_type, source.api_type, source.active,
  source.request_headers, source.request_query, source.request_body,
  (SELECT id FROM public.sap_system WHERE is_active ORDER BY updated_at DESC, created_at DESC LIMIT 1)
FROM quality_sap_endpoint_sync source
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sap_endpoint existing
  WHERE lower(btrim(existing.name)) = lower(btrim(source.name))
);

COMMIT;