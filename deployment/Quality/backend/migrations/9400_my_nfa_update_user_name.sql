-- Rerunnable: blank the sample user_name in the "Edit IN My NFA" body template.
-- The live value is always the signed-in User ID. Preserves ID, method, path, credentials.
BEGIN;
UPDATE public.sap_endpoint
SET request_body = jsonb_set(request_body::jsonb, '{submit,user_name}', '""'::jsonb, true)::text,
    updated_at = now()
WHERE lower(btrim(name)) = 'edit in my nfa'
  AND request_body IS NOT NULL AND request_body::jsonb ? 'submit'
  AND (request_body::jsonb #>> '{submit,user_name}') IS DISTINCT FROM '';
COMMIT;
