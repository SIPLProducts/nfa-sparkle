# Attached Docs on My NFAs — use the "Attachments In My NFA" API

The **Attached Docs** button on the My NFAs screen currently calls the same SAP endpoint as the Reports screen ("Attachments IN Reports"). It should instead use the separately registered **Attachments In My NFA** endpoint (POST `/e-nfa/enfa_report/create?sap-client=300`, body `{ "attachment": { "reffld": "<ENFA no>" } }`), exactly as configured in Admin → SAP API Settings.

## What changes for the user

- Selecting a record on **My NFAs** and clicking **Attached Docs** fetches documents through the "Attachments In My NFA" configuration (its own path, method, headers, query, credentials and active flag).
- The listed files, their names and types come straight from the SAP response — view and download work as they already do on Reports.
- Uploading from the dialog still posts to SAP and then refreshes the list from the same endpoint.
- Loading, "no documents in SAP", and SAP error states are unchanged.
- The Reports screen keeps using "Attachments IN Reports" — no behaviour change there.
- Nothing hardcoded: the endpoint row already exists in API Settings and stays fully editable there.

## Technical notes

- `src/lib/sap-report.server.ts`: `callEnfaAttachments(reffld, endpoint)` gains an endpoint selector — `"report"` resolves the exact name `Attachments IN Reports` (current behaviour), `"my"` resolves `Attachments In My NFA`, each with the existing fallback/inactive-endpoint error handling. The ENFA number is substituted into the endpoint's saved body template when it contains an `attachment.reffld` shape, otherwise the standard payload is built.
- `src/routes/api/public/enfa-attachments.ts`: accepts an optional `endpoint` field in the request body (validated to the two allowed values, defaulting to `"report"`) and passes it through. Auth, envelope unwrapping and base64/MIME extraction stay as they are.
- `src/components/report/RecordAttachmentsDialog.tsx`: new optional `endpoint` prop, forwarded by `useSapDocuments` to the proxy call; default keeps Reports behaviour.
- `src/routes/_authed.nfa.my.tsx`: renders `<RecordAttachmentsDialog ... endpoint="my" />`, matching how Preview and Edit already select their My-NFA endpoints.
- No schema or migration changes — the "Attachments In My NFA" row is already registered and active.
