# Approval Chain: use SAP's delete request for Delete

## Goal
Deleting a chain in User Management → Approval Chain must send SAP's exact `delete_user` request to the Create Approvals endpoint (PUT, same base URL), instead of the current workaround that sends a create payload with blanked approver slots.

## SAP contract (from the provided sample)
- URL/method: same Create Approvals endpoint, PUT — already configured in SAP API Settings, nothing hardcoded.
- Request body:
```json
{
  "delete_user": {
    "MANDT": "300",
    "PSPNR": "9000",
    "FUNCT": "BUDGET DEVIATION",
    "EXTR_TXT": "PROJECTS",
    "BEGDA": "2026-10-02",
    "ENDDA": "9999-12-31",
    "DESIG1": "Abaper", "USERID1": "SIPL_QM",
    "DESIG2": "", "USERID2": "", "...": "DESIG7/USERID7"
  }
}
```
- Differences from create/update: `delete_user` wrapper, all-uppercase keys, includes `MANDT`, dates in ISO form (`YYYY-MM-DD`), and no `LINE_INDEX`.
- Success response: `[{ "TYPE": "S", "MESSAGE": "Data deleted Successfully" }]` — the existing response parser already handles this shape.

## Changes
1. `src/lib/sap-approval-chain.ts` — `buildApprovalChainPayload(chain, "delete")` builds the `delete_user` body: uppercase keys, `MANDT` from the SAP client (from the configured endpoint's `sap-client` value, falling back to the chain's saved client if present), ISO dates, the chain's existing levels serialized into the seven DESIG/USERID slots (SAP identifies the row by key fields, so the existing levels are sent as stored), no `LINE_INDEX`. Create (`create_user`) and update (`Update_user`) payloads stay byte-identical to today.
2. `src/lib/sap-approval-chain.test.ts` / `sap-approval-chain-create.test.ts` — update the delete test to assert the exact `delete_user` sample shape; keep create/update tests unchanged.
3. No UI changes: the existing Delete button and confirmation stay as-is; SAP's reply message is shown and the list reloads from SAP, same as save/update.

## Out of scope / unchanged
- Add chain, Edit chain, chain list loading, all other screens and workflows.
- No hardcoded values: endpoint, method, client, and key fields all come from SAP API Settings and the selected chain row.

## Verification
- Unit tests for all three operations; typecheck and build.
- Live delete against SAP is tested by the user after deploy (upload complete `dist`, restart only the web app, PM2 id 16).
