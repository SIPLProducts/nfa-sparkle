update public.sap_endpoint
set request_body = '{ "reject": { "user_name": "", "REFFLD": "", "Comment": "" } }',
    updated_at = now()
where lower(name) = 'reject button';