UPDATE public.sap_endpoint
SET http_method = 'PUT',
    request_body = '{
  "upload": {
    "user_name": "SIPL_QM1",
    "reffld": "",
    "file": [
      {
        "file_name": "enfa.pdf",
        "file": ""
      }
    ]
  }
}',
    updated_at = now()
WHERE lower(name) IN ('upload document', 'attached docs in my nfa');