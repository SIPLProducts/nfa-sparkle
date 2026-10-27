# Show the ENFA number in the Dynamic Approvers tab on the self-hosted server

## What the screenshots show
- **Local (enfa.siplproducts.com):** each card has a heading like "NFA 100190", and SIPL_QM is listed as the approver.
- **Server (10.200.1.7):** the approver rows arrive (DIRE-PROJ, CFO 22010458, and so on), but the heading is only "NFA —".
- The User IDs on the server are different (22010458 and similar). This shows the server is connected to a different SAP system than local.

## Likely cause (not yet confirmed)
The portal reads the ENFA number from one SAP field only, `REFFLD`. It works locally because the local SAP system sends that field. The approver details still come through on the server, so the request itself works. The server's SAP system probably sends the ENFA number under a different field name, which the portal ignores. That leaves the heading blank.

The same lookup routes workflow emails to dynamic approvers, so those emails on the server are probably affected too.

## Steps
1. **Confirm the field name.** On the server, open SAP API Settings, find "Dynamic Approvers List", and click Test. Check which field holds the ENFA number in the response (for example `REF_FLD`, `ENFA_NO`, `NFA_NO`). Please send me a screenshot of that response if you can.
2. Read the ENFA number from `REFFLD` first, then from the common alternative field names. The confirmed name from step 1 will be included.
3. Do not change the request sent to SAP, the levels, designations, User IDs, emails or any workflow. Local keeps working through `REFFLD`.

## Technical details
- `src/lib/sap-dynamic-approvers.ts`: in `parseDynamicApprovers`, take the first non-blank value from `REFFLD`, `REF_FLD`, `ENFA_NO`, `ENFANO`, `NFA_NO`, `NFANO`, `ENFA_NUMBER` (case-insensitive, trimmed). Keep leading-zero handling unchanged in `dynamicChainIds`.
- Add unit tests:
  - `REFFLD` still works
  - an alternative field name fills the ENFA number
  - `REFFLD` wins when both are present.
