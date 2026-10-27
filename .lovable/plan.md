# Finish the ENFA number fix on the server

The database update ran successfully. Nothing else needs to change in the app. These steps finish the fix.

## Steps
1. **Check the saved address.** In the SQL Editor, run:
   `SELECT name, method, path_or_url, request_body FROM public.sap_endpoint WHERE name ILIKE '%dynamic%';`
   "Dynamic Approvers List" should show `/e-nfa/enfa_report//create?sap-client=300`. "Dynamic Approvals" (used by Create NFA) must still show its original address and the `get_detail` body. If either looks wrong, send me a screenshot.
2. **Deploy the latest build**, if you haven't since the last fix. Run `npm run build` on your PC. Upload `dist` as `dist.new` with WinSCP. Then in PuTTY: `mv dist dist_backup_$(date +%Y%m%d_%H%M)`, `mv dist.new dist`, `pm2 restart enfa-quality-app --update-env`.
3. **Test it.** Open `http://10.200.1.7:8081` and press Ctrl+F5. Go to User Management, then Dynamic Approvers. Each card should now be titled with its ENFA number (for example "NFA 100234").
4. **If it still shows "NFA —":** open SAP API Settings, then Dynamic Approvers List, then Test, and send me a screenshot of the response.

## Not changed
Create NFA approvers, Predefined chains, emails, payloads and every other API.
