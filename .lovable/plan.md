# SAP attachments in the eNFA Report

Wire the SAP "Attachments IN Reports" API into API Settings and the report screen's **Attached Docs** action, so the documents shown come live from SAP instead of only the local store.

## What changes for the user

- **Attached Docs** on the report toolbar now lists the files SAP returns for the selected ENFA number.
- Each file can be **viewed** (PDF/image rendered in-app, same viewer used for Preview so Chrome's PDF block is avoided) and **downloaded**.
- Locally uploaded files stay visible in the same dialog, grouped separately (SAP documents / uploaded in this app), so nothing existing is lost.
- Clear states for loading, "no documents in SAP", and SAP/middleware errors.
- The endpoint appears in Admin → SAP API Settings like the others (name **Attachments IN Reports**, POST, relative path, body template `{ "attachment": { "reffld": "" } }`), so path, method, headers, query, credentials and active flag are all editable there.

## How it works

- Request: `{ "attachment": { "reffld": "<ENFA number>" } }`
- Response: an array of `{ FILE_NAME, FILE_CONTENT }` where `FILE_CONTENT` is base64. File type is inferred from the file name extension and, when absent, from the base64 signature (PDF/PNG/JPEG), so items like `3000059878 @r0` still render.

## Technical notes

- `src/lib/sap-report.server.ts`: new `callEnfaAttachments(reffld)` following the `callEnfaPrint` pattern — resolves the endpoint dynamically (exact name `Attachments IN Reports`, fallback `%attach%` excluding report/create/company/plant/type/function/update/preview rows), loads system + credentials, posts the payload with a large `maxBytes` for base64 content. Nothing hardcoded.
- New `src/routes/api/public/enfa-attachments.ts`: bearer-token check + normalization mirroring `enfa-print.ts`, unwrapping the middleware `{ body }` envelope and returning a clean JSON array.
- `src/components/report/RecordAttachmentsDialog.tsx`: fetch SAP files when the dialog opens, render a "SAP documents" section above the existing local list; view uses a blob URL with the canvas-based PDF renderer already added for Preview, download uses the same blob. Existing upload/delete behaviour for local files is untouched.
- Migration inserting the endpoint row (idempotent, only if a row with that name does not already exist) so it shows in API Settings out of the box.
