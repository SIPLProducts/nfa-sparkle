UPDATE public.sap_endpoint
SET request_body = '{
  "upload": {
    "reffld": "100072",
    "file": [
      {
        "file_name": "enfa.pdf",
        "file": ""
      }
    ]
  }
}', updated_at = now()
WHERE name ILIKE 'Attached Docs In MY NFA' AND (request_body IS NULL OR btrim(request_body) = '');