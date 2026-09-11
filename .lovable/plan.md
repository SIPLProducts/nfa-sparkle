# Fix E-NFA Report 500 Error

## Confirmed root cause

- The report request reaches `/api/public/enfa-report` with a valid signed-in session.
- It then fails while loading SAP settings from the backend because the running server process cannot read `SUPABASE_SERVICE_ROLE_KEY`.
- The uncaught server exception produces the generic “The app encountered an error” dialog.
- The report screen incorrectly labels that application-side 500 as “SAP responded with status 500,” although no SAP request was made.
- The current user profile has no SAP User ID (`username` is empty). After the server configuration is restored, sending a blank `user_name` could still make SAP reject or mis-scope the report.
- The configured eNFA Report entry itself exists and is active: PUT through the configured middleware to the DEV300 SAP system.

## Implementation

1. **Make report failures safe and accurate**
   - Catch backend configuration, endpoint lookup, middleware, and SAP failures in the report endpoint.
   - Always return a structured JSON error instead of the framework’s generic HTML error page.
   - Distinguish “application configuration error,” “middleware unavailable,” and a real SAP HTTP error.

2. **Correct the report screen message**
   - Display the structured server/provider message returned by the endpoint.
   - Use “SAP responded…” only when SAP was actually contacted and supplied that status.
   - Prevent the duplicate generic error dialog by ensuring the route handles the failure itself.

3. **Validate the SAP User ID before execution**
   - Resolve the signed-in user’s configured SAP User ID before submitting the report.
   - If it is blank, stop cleanly and tell the user that their SAP User ID must be assigned in User Management instead of sending `user_name: ""`.
   - Keep all existing report filters and the exact SAP payload keys unchanged.

4. **Restore the server configuration**
   - Ensure the running preview/published server receives the existing private backend key at process startup; do not expose it to the browser or hardcode it.
   - For the Ubuntu Quality deployment, keep the same requirement in the PM2 runtime environment and restart only the Quality app process with its environment refreshed.

5. **Verification**
   - Run the report with an authenticated user that has a SAP User ID.
   - Confirm the endpoint returns JSON in success and failure cases.
   - Confirm middleware/SAP failures show their real response without crashing the page.
   - Confirm report results, filters, upload, attachments, preview, and edit remain unchanged.

## Not changed

- No SAP endpoint, method, credentials, payload field names, workflow, database records, Print Form, or Microsoft Word integration will be changed.
