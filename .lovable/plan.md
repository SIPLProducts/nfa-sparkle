# Add two status options to the Reports filter

## What changes
On the E-NFA Report screen, the Status row currently offers three checkboxes: In Process, Completed, Rejected. Two more will be added, in this order:

- In Process
- Completed
- Rejected
- Back to Initiator
- Requested Clarification

Existing options stay exactly as they are (same labels, same behaviour, same payload keys).

## Scope
UI only. The two new checkboxes are added to the filter form and reset with the Reset button like the others. No SAP payload keys were provided for them, so they are not sent to SAP yet — once you share the exact keys (e.g. `r_back`, `r_clar`, including any trailing spaces), they can be wired into the request payload.

## Technical detail
- `src/routes/_authed.report.tsx`: extend the local filter state with two new flag fields, add the two checkbox labels to the status row, and include them in the flag setter union type and the reset defaults.
- No change to `src/lib/sap-api-constants.ts`, `sap-report.server.ts`, or the endpoint payload template.
