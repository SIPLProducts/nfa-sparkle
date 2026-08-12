DO $$
DECLARE v_sys uuid; v_id uuid; v_body text;
BEGIN
  SELECT id INTO v_sys FROM public.sap_system WHERE is_active ORDER BY created_at LIMIT 1;
  v_body := '{
  "plant_from": "",
  "plant_to": "",
  "funct_from": "",
  "funct_to": "",
  "nfano_from": "",
  "nfano_to": "",
  "extra_from": "",
  "extra_to": "",
  "dat_from": "",
  "dat_to": "",
  "usrid_from": "",
  "usrid_to": "",
  "r_proc": "",
  "r_comp": "",
  "r_reje": ""
}';

  SELECT id INTO v_id FROM public.sap_endpoint
   WHERE name = 'eNFA Report' OR path_or_url LIKE '%enfa_report%' ORDER BY created_at LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.sap_endpoint
      (name, description, module, path_or_url, http_method, auth_type, api_type, active, system_id, request_body, request_headers, request_query)
    VALUES
      ('eNFA Report', 'SAP eNFA report feed used by the Reports screen', 'Common',
       '/e-nfa/enfa_report//create', 'PUT', 'basic', 'fetch', true, v_sys, v_body,
       '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb, '{}'::jsonb);
  ELSE
    UPDATE public.sap_endpoint SET
      name = 'eNFA Report',
      description = COALESCE(description, 'SAP eNFA report feed used by the Reports screen'),
      path_or_url = '/e-nfa/enfa_report//create',
      http_method = 'PUT',
      auth_type = 'basic',
      api_type = 'fetch',
      active = true,
      system_id = COALESCE(system_id, v_sys),
      request_body = COALESCE(NULLIF(request_body, ''), v_body),
      request_headers = CASE WHEN request_headers = '{}'::jsonb
        THEN '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb ELSE request_headers END
    WHERE id = v_id;
  END IF;
END $$;