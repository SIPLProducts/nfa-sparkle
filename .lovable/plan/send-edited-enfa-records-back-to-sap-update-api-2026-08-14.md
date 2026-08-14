# Send edited eNFA records back to SAP (Update API)

## What happens today
Clicking **Update in SAP** on the Reports Edit form posts to the app's update endpoint, which looks for a registered SAP endpoint whose name contains "eNFA Update" or whose path contains `enfa_update`/`enfa_change`. The endpoint actually registered for updates is named **Change Report** (`POST /e-nfa/enfa_report/create?sap-client=300`), so no match is found and the call never reaches SAP. The payload also uses lowercase app-side keys instead of SAP's `submit` wrapper.

## What will change

### 1. Endpoint lookup (no hardcoded URL)
Broaden the dynamic lookup so the registered update endpoint is found by name ("Change Report", "Update", "Submit", "eNFA Update") or by an explicit marker, still reading URL, method, headers, query, and credentials from the API Settings record. Nothing about the SAP host or path is hardcoded.

### 2. Payload shape
The Edit dialog will send SAP's exact structure, built from the selected record plus the values in the form:

```text
{
  "submit": {
    "reffld":          <selected ENFA number>,
    "CC_TEXT":         <company text from the loaded record>,
    "PSPNR":           <plant code>,
    "NAME1":           <plant name>,
    "SUBJECT":         <Subject field>,
    "SCOPE_IMPACT":    <Scope Impact field>,
    "BUDGET_IMPACT":   <Budget Impact field, as string>,
    "TIMELINE_IMPACT": <Timeline Impact field, as string>,
    "TEXT":            <Detailed Description, plain text>
  }
}
```

Values come from the record loaded via the details API and the current form state — no placeholders, no fixed values.

### 3. Visible in Inspect → Network
The browser will keep issuing a plain `POST /api/public/enfa-update` with the JSON body above, and the response body returned to the browser will be SAP's own response (e.g. `"Updated successfully"`), plus headers carrying SAP's status and latency. Both request and response are readable in the Network tab exactly as SAP received/returned them.

### 4. Feedback in the Reports screen
- Success: show SAP's returned message in the toast instead of a generic one.
- Failure: show SAP's error text, or a clear message when the update endpoint is not registered in API Settings.

### 5. API Settings screen
The Change Report endpoint's stored request template will be updated to the `submit` sample payload so Admin → SAP API Settings shows and can test the same request shape the Reports screen sends.

## Technical notes
- `src/lib/sap-report.server.ts` — widen the `callEnfaUpdate` endpoint lookup.
- `src/components/report/RecordEditDialog.tsx` — build the `{ submit: { ... } }` body from `detail` + `draft`; surface SAP's response text in the toast.
- `src/routes/api/public/enfa-update.ts` — pass the body through unchanged (already does); return SAP's raw response body.
- One small database update to the Change Report endpoint's sample request payload.
