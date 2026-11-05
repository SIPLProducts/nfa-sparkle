# Dynamic Approvers API on Create NFA

## What changes for the user
- **Predefined Approvers:** works exactly as today, using the existing Predefined Approvers API.
- **Dynamic Approvers:** the Approvers list starts empty. Once a Company is chosen and its plants have loaded, the screen calls the new Dynamic Approvers API with **every plant** from the Plant list. The approvers it returns can then be selected (with checkboxes) in the same order as today.
- Switching between Predefined and Dynamic clears the list and loads it again from the matching API.
- If SAP returns nothing or fails, a message and a Retry button are shown, the same way they are today.

## New Dynamic API (kept separate)
- URL `http://10.200.1.2:8000/e-nfa/enfa_approval/APPROVAL?sap-client=300`, POST
- Payload:
```text
{ "approvers": { "check": "", "plant": [ { "plant": "9000" }, { "plant": "9001" }, ... ] } }
```
- Response: rows with PSPNR, FUNCT, EXTR_TXT, DESIG1..15 and USERID1..15. These are read with the same reader the screen already uses for approval chains.

## Not changed
The Predefined API and its payload, the Plant and Company calls, the NFA Create submit payload, the minimum-approver check, the Department/Designation/Name display, and all other fields stay the same.

## Technical details
- `src/lib/sap-api-constants.ts`: add `buildDynamicApproversPayload(plants: string[])` → `{ approvers: { check: "", plant: plants.map(p => ({ plant: p })) } }` (deduplicated and trimmed). Add a `DYNAMIC_APPROVERS_ENDPOINT_NAMES` list.
- `src/lib/sap-report.server.ts`: add `callDynamicApprovers({ plants })`, modeled on `callApproverGetDetail`. It looks up the active "Dynamic Approvers" endpoint in SAP API Settings, or falls back to any endpoint whose template contains `"approvers"` (excluding the "Dynamic Approvers List" entry). There is no hardcoded URL. Register the endpoint row (name "Dynamic Approvers", POST, the path above, sample body) with a rerunnable upsert migration, so it can be edited in SAP API Settings.
- Add a matching guarded server route/function (Create NFA access), mirroring the existing approver-chain fetch, plus a client `fetchSapDynamicApprovers(plants)`.
- `ApproverSelector.tsx`: add an optional `plants: string[]` prop. When `check !== "X"`, call the dynamic fetch with `plants` (not the selected plant) and skip fetching while `plants` is empty. The predefined branch is unchanged.
- `_authed.nfa.new.tsx`: pass `plants.map(p => p.code)` to `ApproverSelector`. In dynamic mode, the hint text no longer asks for a Plant.
- Tests: payload builder (several plants produce the exact sample shape, duplicates removed) and parsing the sample response into 4 levels (22004695, 22010458, 22008709, 90000000).
- Production: run the same endpoint upsert SQL.
