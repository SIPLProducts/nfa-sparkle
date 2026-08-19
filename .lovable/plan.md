# Report attachments: SAP only, no duplicate local copy

Today the Attached Docs dialog shows the same file twice: uploads are sent to SAP **and** a second copy is stored in the app's own attachment table, which is rendered in a separate "Uploaded in this app" list. The fix is to make SAP the single source of truth.

## What changes for the user

- Uploading from **Upload File, If Any** (report toolbar) or **Upload File** (inside Attached Docs) sends the file only to SAP, and shows SAP's own reply message.
- After a successful upload, the SAP documents list refreshes and the newly uploaded file appears there once.
- The "Uploaded in this app" section, its delete action and its local file list are removed — the dialog shows one list, straight from the SAP Attachments API.
- Loading, "no documents in SAP", and SAP error states stay as they are.

## Technical notes

- `src/components/report/RecordAttachmentsDialog.tsx`: drop `useSapAttachments`, `uploadSapFile`, the local list markup, `openFile`, `remove`, and the local preview dialog. `onPick` calls `uploadToSap` then `refreshSap()` only. The Upload button and file input move into the SAP documents section header.
- `src/routes/_authed.report.tsx`: `onUploadPick` stops calling `uploadSapFile`; it only calls `uploadToSap` and then reopens/refreshes the attachments dialog so the SAP list reloads.
- `src/components/report/RecordPreviewDialog.tsx`: the attachment count currently comes from the local `sap_attachment` table; switch it to the SAP attachments count (or drop the count) so it never reflects local copies.
- No schema change: the `sap_attachment` table and bucket are simply no longer written to or read from by the report screen. Nothing is hardcoded; all documents come from the registered SAP endpoints.
