UPDATE public.sap_endpoint
SET request_body = '{"approve":{"user_name":"","REFFLD":"","Comment":"","file_path":"","file":""}}',
updated_at = now()
WHERE lower(btrim(name)) = 'approved button';