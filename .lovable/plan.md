# Upload attachments to SAP from the eNFA Report

Wire the SAP **Upload Document** API into the report screen so files picked with "Upload File, If Any" (and the Upload button inside Attached Docs) are sent to SAP as base64, instead of only being stored in the app.

## What changes for the user

- Selecting a record and clicking **Upload File, If Any** now sends each chosen file to SAP against that ENFA number.
- The toast shows SAP's own reply, e.g. "File upload successfull with ENFA No 100072" — nothing hardcoded; failures show SAP's error text.
- After a successful upload, **Attached Docs** refreshes so the new file appears in the "SAP documents" list returned by the Attachments API.
- Uploading from inside the Attached Docs dialog behaves the same way.
- The endpoint stays fully editable in Admin → SAP API Settings (name **Upload Document**, POST, relative path, body template `{ "upload": { "reffld": "", "file": [] } }`), so path, method, headers, query, credentials and the active flag all come from there.

## Request / response

- Request: `{ "upload": { "reffld": "<ENFA number>", "file": [ { "file_name": "enfa.pdf", "file": "<base64>" } ] } }` — all selected files go in one `file` array.
- Response: `{ "STATUS": "S", "MESSAGE": "...", "ENFA_NO": "..." }`; `STATUS` other than `S` is treated as a failure and the message is shown as-is.

## Technical notes

- `src/lib/sap-report.server.ts`: new `callEnfaUpload(reffld, files)` following the `callEnfaAttachments` pattern — exact name match on `Upload Document`, fallback `%upload%` excluding report/create/company/plant/type/function/update/preview/attach rows; loads system + credentials dynamically; large `maxBytes` for base64 bodies.
- New `src/routes/api/public/enfa-upload.ts`: bearer check, unwraps the middleware `{ body }` envelope, normalizes `STATUS/MESSAGE/ENFA_NO` into clean JSON (mirrors `enfa-print.ts` / `enfa-attachments.ts`).
- `src/components/report/RecordAttachmentsDialog.tsx`: shared `uploadToSap(enfaNumber, files)` helper that base64-encodes files client-side (with a total-size guard like the Create eNFA push) and posts to the new route; the SAP documents list re-fetches on success.
- `src/routes/_authed.report.tsx`: `onUploadPick` calls the SAP upload; keeping the local copy in `sap_attachment` is retained so nothing existing is lost.
- Migration only if the `Upload Document` row's body template needs seeding; the row already exists and is active, so no schema change is required.
