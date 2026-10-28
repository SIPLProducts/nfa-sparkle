-- Focused, rerunnable My NFAs Edit setting alignment.
-- Preserves endpoint IDs, activation, systems, credentials and all other endpoints.
BEGIN;
UPDATE public.sap_endpoint
SET path_or_url = '/e-nfa/enfa_approval/APPROVAL?sap-client=300',
    http_method = 'PUT',
    request_body = '{"edit":{"user_name":"","reffld":""}}',
    updated_at = now()
WHERE lower(btrim(name)) = 'my nfa select'
  AND (path_or_url IS DISTINCT FROM '/e-nfa/enfa_approval/APPROVAL?sap-client=300'
    OR http_method IS DISTINCT FROM 'PUT'
    OR request_body IS DISTINCT FROM '{"edit":{"user_name":"","reffld":""}}');
COMMIT;