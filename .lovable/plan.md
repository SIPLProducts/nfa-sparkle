# Fix “Update in SAP” for edited eNFA records

## Confirmed current state

- The **Change Report** endpoint is active and configured as `PUT /e-nfa/enfa_report/create?sap-client=300`.
- The local SAP middleware health endpoint is reachable.
- The edit dialog already assembles a `submit` object, but the captured browser traffic contains no `/api/public/enfa-update` request, matching the reported “nothing happens” behavior.
- The exact client-side click failure still needs to be reproduced before assigning a specific root cause.

## Implementation

1. **Make the Update action deterministic**
   - Reproduce the button click in the live Reports flow and inspect browser/runtime errors.
   - Convert the action to an explicit, validated submit handler with a `type="button"` control so nested dialogs/forms cannot swallow or redirect the click.
   - Show immediate progress and always surface a clear success or failure message.

2. **Build SAP’s payload dynamically from the selected record and current edits**
   - Send the selected NFA number and live SAP company/plant values.
   - Send the edited Subject, Scope Impact, Budget Impact, Timeline Impact, and Detailed Description.
   - Preserve SAP’s exact wrapper and key names:

```text
{
  "submit": {
    "reffld": "<selected NFA ID>",
    "CC_TEXT": "<company>",
    "PSPNR": "<plant code>",
    "NAME1": "<plant name>",
    "SUBJECT": "<edited subject>",
    "SCOPE_IMPACT": "<edited scope>",
    "BUDGET_IMPACT": "<edited budget as a 2-decimal string>",
    "TIMELINE_IMPACT": "<edited days as a string>",
    "TEXT": "<edited description as plain text>"
  }
}
```

3. **Harden the update API path**
   - Validate the authenticated request and required `submit.reffld` before calling SAP.
   - Resolve the active **Change Report** endpoint dynamically from API Settings; keep its configured PUT method, path, SAP system, headers, query, and credentials.
   - Pass the body unchanged through the middleware and return SAP’s raw response, including `"Updated successfully"`.
   - Add actionable server-side logging for request routing and upstream failures without logging credentials.

4. **Refresh after success**
   - Close the edit dialog after SAP confirms success.
   - Re-fetch the selected record from SAP so the Reports/Edit view reflects the updated values rather than stale local data.

## Verification

- Select record `100069`, edit every supported field, and click **Update in SAP**.
- Confirm a visible `/api/public/enfa-update` request appears in Inspect → Network with the exact dynamic `submit` payload.
- Confirm the middleware sends PUT to `/e-nfa/enfa_report/create?sap-client=300`.
- Confirm the browser receives `"Updated successfully"`, displays it, and the refreshed SAP record contains the edited values.
- Verify failure cases: no session, missing NFA ID, unreachable middleware, and non-success SAP response all show a useful error and never silently do nothing.