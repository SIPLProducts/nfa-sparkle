# Add the logged-in User ID to the My NFAs "Update in SAP" payload

## Current state
On My NFAs, Edit → Update in SAP sends the `submit` payload to the "Edit IN My NFA" endpoint, but the payload has no `user_name`. The value `PARDEEP` in API Settings is only a saved sample and is never used for the real call.

## What will change
- Update in SAP will send exactly this shape, with `user_name` first:

```text
{ "submit": {
    "user_name": <User ID of the signed-in person>,
    "reffld": <selected record>,
    "CC_TEXT", "PSPNR", "NAME1", "FUNCT", "SUBJECT",
    "SCOPE_IMPACT", "BUDGET_IMPACT", "TIMELINE_IMPACT", "TEXT"  (from the form)
} }
```

- The User ID is looked up on the server from the signed-in account (the same ID typed at login), uppercased. Anything the browser sends for `user_name`, the saved sample (`PARDEEP`) and the SAP connection login are never used.
- If the User ID can't be found, the update stops with a clear message instead of sending a wrong ID.
- The sample in API Settings becomes `"user_name": ""` so no real person's ID is stored as a sample.
- Other calls already send the signed-in User ID (Edit load, Approvals list and actions, Reports, Create, Upload) and stay as they are. Field values, SAP reply handling, the list refresh and other screens are unchanged.

## Technical notes
- `src/routes/api/public/enfa-my-update.ts`: after verifying the token, read `profiles.username` for `claims.sub`. Return 400 if it is empty, otherwise pass it to the update call.
- `src/lib/sap-report.server.ts` `callEnfaMyNfaUpdate(payload, { user_name })`: rebuild `submit` as `{ user_name, ...rest without user_name }`.
- Add a small pure helper with Vitest cases in `src/lib/sap-edit.ts`: user_name injected first, caller value overridden, and an error when it is missing.
- Rerunnable migration `deployment/Quality/backend/migrations/9400_my_nfa_update_user_name.sql`, plus the same live update, to blank the sample `user_name` in the "Edit IN My NFA" body template. The endpoint's ID, method, path and credentials are kept.
