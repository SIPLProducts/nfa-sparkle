# Save My NFA edits back to SAP through the approval Update API

## Current state
The "Edit IN My NFA" endpoint is already registered in API Settings (`/e-nfa/enfa_approval/APPROVAL?sap-client=300`) with the `submit` body sample, but its HTTP method is saved as **POST** instead of **PUT**.

The Edit dialog on My NFAs loads the record from "MY NFA Select" correctly, but its **Update in SAP** button always routes to the Reports update endpoint ("Change Report" on `/e-nfa/enfa_report/create`), so My NFA edits go to the wrong SAP service. The payload it sends also omits `FUNCT`.

## What will change

### API Settings
- Correct the registered "Edit IN My NFA" endpoint method to **PUT** so the screen shows and tests the same call the app makes. Path, host, credentials, headers and query stay as saved — nothing hardcoded in code.

### My NFAs → Edit dialog
- **Update in SAP** on the My NFAs screen calls the "Edit IN My NFA" endpoint (resolved dynamically by name from API Settings), while the Reports screen keeps using its existing "Change Report" endpoint.
- The request body is built from the record loaded via MY NFA Select plus the current form values:

```text
{ "submit": {
    "reffld": <ENFA number>,
    "CC_TEXT": <company text>,
    "PSPNR": <plant code>,
    "NAME1": <plant name>,
    "FUNCT": <NFA type / function from the loaded record>,
    "SUBJECT": <Subject>,
    "SCOPE_IMPACT": <Scope Impact>,
    "BUDGET_IMPACT": <Budget Impact, numeric>,
    "TIMELINE_IMPACT": <Timeline Impact, numeric>,
    "TEXT": <Detailed Description as plain text>
} }
```

- SAP's own reply ("Updated successfully" or an error text) is shown in the toast — no invented messages.
- After a successful update the My NFAs list refreshes so the SAP values shown in the table are the live ones.
- Request and response remain visible in the browser Network tab as a plain call, as with the other SAP integrations.

## Technical notes
- `src/lib/sap-report.server.ts`: add `callEnfaMyNfaUpdate(payload)` resolving the endpoint by name ("Edit IN My NFA", fallback `%edit%my nfa%` / approval-path submit rows), reusing the existing dynamic endpoint/credential resolution.
- New proxy route `src/routes/api/public/enfa-my-update.ts`, bearer-verified, mirroring `enfa-update.ts` and returning SAP's raw body plus status/latency headers.
- `src/components/report/RecordEditDialog.tsx`: when `endpoint="select"`, post to the new route and include `FUNCT`; add an `onUpdated` callback.
- `src/routes/_authed.nfa.my.tsx`: refresh the list after a successful update.
- One database update: set the "Edit IN My NFA" endpoint's method to PUT.
