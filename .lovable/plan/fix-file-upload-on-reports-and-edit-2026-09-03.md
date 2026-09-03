# Fix file upload on Reports and Edit

## What you are seeing

The upload call returns `{"status":null,"message":null,"enfaNo":null}`. That is the app's own
"success" shape when SAP's reply carried no `STATUS` / `MESSAGE` / `ENFA_NO` at all — i.e. the
response body was empty or not the expected JSON. Verified in the code: `/api/public/enfa-upload`
treats a missing `STATUS` as success (`const ok = !status || ...`), so an empty SAP answer is
reported as an upload that worked, while nothing was actually attached.

Verified configuration (both upload rows are correct and active): **Upload Document** and
**Attached Docs In MY NFA**, method PUT, path `/e-nfa/enfa_report/create?sap-client=300`, body
template `{ "upload": { "user_name": "", "reffld": "", "file": [ { "file_name": "enfa.pdf", "file": "" } ] } }`.

The exact reason SAP returned nothing is not yet confirmed, so step 1 is to make the failure
visible instead of silent, then fix what it reports.

## Plan

1. Stop reporting empty replies as success
   - In `src/routes/api/public/enfa-upload.ts`, only treat the call as successful when SAP actually
     returned `STATUS = S` (or a message containing "success"). An empty or unparseable body becomes
     a clear error: "SAP accepted the request but returned no response - the file was not attached",
     with SAP's HTTP status included.
   - Keep returning `x-sap-url`, `x-sap-method`, `x-sap-request`, `x-sap-status`, and add
     `x-sap-response` (first 2000 chars of SAP's raw reply) so the real answer is readable in
     Inspect -> Network.
   - Log the raw SAP body server-side for the upload route.

2. Remove the two size traps that silently break large uploads
   - The on-prem middleware parses JSON with a 5 MB limit (`MAX_BODY`), while the app allows 40 MB of
     files; a base64 payload above ~3.7 MB is rejected before it ever reaches SAP. Raise the default
     to 50 MB in `middleware/server.js` (still overridable via `MAX_BODY`) and document it in
     `middleware/.env.example` / `deploy/env/middleware.env.quality.example`.
   - `callEnfaUpload` already asks for a 180 s timeout and 20 MB response cap - unchanged.

3. Surface SAP's message in the UI
   - `uploadToSap` in `src/components/report/RecordAttachmentsDialog.tsx` throws with the server's
     error text (already the case) - the Reports toolbar and the Attached Docs dialog will now show
     SAP's real message ("Attachment Can Only Be attached By Initiator", or the new empty-response
     message) instead of a false "Uploaded" toast.
   - On genuine success (`STATUS = S`) the SAP documents list still refreshes as today.

4. Edit screen
   - The SAP record Edit dialog (`RecordEditDialog`) has no upload control today; uploading from an
     open record is done through **Attached Docs**. Add the same "Upload File" button to the Edit
     dialog footer, reusing the existing `uploadToSap` helper with the record's ENFA number and the
     same endpoint selector used by the screen (`report` on Reports, `my` on My NFAs). No new API,
     no payload change.

## Technical notes

- Files touched: `src/routes/api/public/enfa-upload.ts` (success criteria, raw-body header, logging),
  `middleware/server.js` (body limit default) plus the two env examples,
  `src/components/report/RecordEditDialog.tsx` (upload button wired to `uploadToSap`).
- No change to the SAP payload shape, endpoint rows, methods, credentials, filters, or any other screen.
- After the change, one upload attempt from Reports will show SAP's real reply in the toast and in
  `x-sap-response`; that tells us in one shot whether the remaining issue is user/initiator
  authorisation or the SAP service itself.
