UPDATE public.sap_endpoint
SET request_body = '{
  "upload": {
    "user_name": "",
    "reffld": "",
    "file": [
      {
        "file_name": "enfa.pdf",
        "file": ""
      }
    ]
  }
}'::jsonb
WHERE name IN ('Upload Document', 'Attached Docs In MY NFA');