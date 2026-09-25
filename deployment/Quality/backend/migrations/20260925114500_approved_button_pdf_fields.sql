UPDATE public.sap_endpoint
SET request_body = jsonb_set(
  jsonb_set(
    CASE
      WHEN request_body IS NULL OR btrim(request_body) = '' THEN '{"approve":{}}'::jsonb
      ELSE request_body::jsonb
    END,
    '{approve,file_path}', '""'::jsonb, true
  ),
  '{approve,file}', '""'::jsonb, true
)::text,
updated_at = now()
WHERE lower(btrim(name)) = 'approved button'
  AND jsonb_typeof(
    CASE
      WHEN request_body IS NULL OR btrim(request_body) = '' THEN '{"approve":{}}'::jsonb
      ELSE request_body::jsonb
    END -> 'approve'
  ) = 'object';