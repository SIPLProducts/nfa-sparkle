# Remove the "Dynamic Approvals In Create" API setting

- Delete the "Dynamic Approvals In Create" entry from SAP API Settings. Its test history goes with it.
- The other API settings stay unchanged, including "Dynamic Approvers" and "Dynamic Approvers List".
- The Total APIs count goes down by one (for example, 35 becomes 34).

## Effect
- Choosing "Budgeted" on Create NFA will no longer load an approver list from SAP. You confirmed this is fine.
- The Non Budgeted (Deviation) option, the payloads and all other screens stay the same.

## Technical details
- Delete the `sap_endpoint` row with id `e41fb41e-1617-4629-9539-154f9570e764`, along with its `sap_test_log` rows.
- No code changes. Quality and Production need the same delete, matched by the endpoint name.
