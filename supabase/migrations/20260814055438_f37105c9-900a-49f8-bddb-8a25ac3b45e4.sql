UPDATE public.sap_endpoint
SET request_body = '{
  "report": {
    "plant_from": "",
    "plant_to": "",
    "funct_from": "",
    "funct_to": "",
    "nfano_from": "",
    "nfano_to ": "",
    "extra_from": "",
    "extra_to ": "",
    "dat_from": "",
    "dat_to": "",
    "usrid_from": "",
    "usrid_to": "",
    "r_proc": "",
    "r_comp ": "",
    "r_reje": ""
  }
}'
WHERE name = 'eNFA Report' OR path_or_url LIKE '%enfa_report%';