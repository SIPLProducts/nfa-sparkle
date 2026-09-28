UPDATE public.sap_endpoint
SET request_body = jsonb_build_object(
  'reject',
  jsonb_build_object(
    'user_name', '',
    'REFFLD', '',
    'Comment', '',
    'file_path', '',
    'file', ''
  )
)::text,
updated_at = now()
WHERE lower(name) = lower('Reject Button')
  AND request_body IS DISTINCT FROM jsonb_build_object(
    'reject',
    jsonb_build_object(
      'user_name', '',
      'REFFLD', '',
      'Comment', '',
      'file_path', '',
      'file', ''
    )
  )::text;