-- Dynamic Approvers List must call the enfa_report service (returns REFFLD per NFA),
-- not enfa_approval/APPROVAL (returns master chains without ENFA number). Rerunnable.
UPDATE public.sap_endpoint
   SET path_or_url = regexp_replace(path_or_url, '/e-nfa/enfa_approval/APPROVAL', '/e-nfa/enfa_report//create', 'i'),
       updated_at = now()
 WHERE name ILIKE 'Dynamic Approvers List'
   AND path_or_url ILIKE '%enfa_approval/APPROVAL%';
