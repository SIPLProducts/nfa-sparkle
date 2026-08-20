# Upload documents to SAP from My NFAs (own registered endpoint)

The My NFAs screen currently uploads through the same "Upload Document" endpoint the Reports screen uses. This gives My NFAs its own registered endpoint, so uploads there are driven by API Settings just like Attached Docs, Preview and Edit already are.

## What changes for the user

- The endpoint registered in Admin -> SAP API Settings as **Attached Docs In MY NFA** (POST, `/e-nfa/enfa_report/create?sap-client=300`) gets its request body template seeded so it is usable as the My NFA upload endpoint:
  `{ "upload": { "reffld": "100072", "file": [ { "file_name": "enfa.pdf", "file": "" } ] } }`
  Path, method, headers, query, credentials and the active flag stay fully editable there.
- On **My NFAs**, both **Upload File, If Any** (toolbar) and **Upload File** (inside the Attached Docs dialog) send the picked files to SAP through that endpoint.
- The toast shows SAP's own reply, e.g. "File upload successfull with ENFA No 100072". `STATUS` other than `S` is treated as a failure and SAP's `MESSAGE` is shown as-is — nothing hardcoded.
- After a successful upload, the Attached Docs list re-fetches from the **Attachments In My NFA** endpoint so the new file appears.
- The Reports screen keeps using **Upload Document** exactly as today.
- If the selected NFA has no SAP eNFA number, the action shows a clear message instead of calling SAP.

## Technical notes

- Migration: set `request_body` on the existing `Attached Docs In MY NFA` row to the upload template (currently null). No schema change.
- `src/lib/sap-report.server.ts`: `callEnfaUpload(reffld, files, endpoint: "report" | "my" = "report")` — exact-name lookup on `Attached Docs In MY NFA` when `endpoint === "my"`, otherwise `Upload Document`; existing fuzzy fallback retained. The saved `request_body` template is used and `reffld` / `file[]` substituted, matching how the other My NFA calls work.
- `src/routes/api/public/enfa-upload.ts`: read the optional `endpoint` field from the request and forward it; response normalization (`STATUS`/`MESSAGE`/`ENFA_NO`) unchanged.
- `src/components/report/RecordAttachmentsDialog.tsx`: `uploadToSap(enfaNumber, files, endpoint)` passes the selector through; the dialog forwards its existing `endpoint` prop to the inner Upload button.
- `src/routes/_authed.nfa.my.tsx`: `onUploadPick` calls `uploadToSap(..., "my")`; the Attached Docs dialog already passes `endpoint="my"`.
