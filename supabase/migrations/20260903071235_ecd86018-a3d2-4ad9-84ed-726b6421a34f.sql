UPDATE public.sap_endpoint
SET request_body = '{ "INITIATOR": { "user_name": "", "REFFLD": "", "Comment": "" } }'
WHERE lower(name) IN ('back to intiator', 'back to initiator');

UPDATE public.sap_endpoint
SET request_body = '{ "clarification": { "user_name": "", "REFFLD": "", "Comment": "" } }'
WHERE lower(name) = 'clarification button';