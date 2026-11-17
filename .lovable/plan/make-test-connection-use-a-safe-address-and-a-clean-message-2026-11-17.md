# Make "Test connection" use a safe address and a clean message

## Why it shows that address
The test picked the first active API linked to this SAP system, which happened to be `/e-nfa/enfa_report/create` (the Create NFA API). The message then showed that address. A create API should never be used for a connection check, because it could send a create request to SAP.

## Change
1. Test connection only uses lookup (read-only) APIs, in this order: Plant F4, Company F4, NFA Type F4, any other F4 lookup.
2. Never use APIs whose address or name contains create, approve, reject, edit, change, delete, upload or save.
3. If no safe lookup API is found, use SAP's standard ping address.
4. The success message shows just "SAP DEV OK · 200 · 879 ms", without the address. The tested address stays in the test log.

## Unchanged
API tests on the APIs tab, all SAP calls in Create NFA, Approvals and Reports, payloads and settings.

## Technical details
- `src/lib/sap-api.functions.ts` (`testSapSystem`): add a safe-endpoint filter and priority list before choosing the endpoint.
- `src/routes/_authed.admin.sap-api.index.tsx`: revert the label back to the system name only.
