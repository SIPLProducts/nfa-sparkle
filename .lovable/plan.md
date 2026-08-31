# Upload Document API: user_name + PUT, wired end to end

Bring the Upload flow (Reports toolbar "Upload File, If Any" and the Upload button inside Attached Docs) in line with the SAP ZENFA Report upload service, and keep everything settings-driven and visible in Inspect → Network.

## What changes

**Request payload**

Uploads now send the exact SAP shape, with the initiator's SAP user id included:

```text
{ "upload": { "user_name": "SIPL_QM1", "reffld": "100102",
              "file": [ { "file_name": "enfa.pdf", "file": "<base64>" } ] } }
```

- `user_name` is resolved on the server from the registered endpoint's credentials (endpoint override, else the SAP system user), upper-cased — the same way the Edit/Detail call already does it. Nothing hardcoded.
- `reffld` is the selected ENFA number; `file` carries every picked file as base64.

**HTTP method**

The Upload Document call uses the method configured in Admin → SAP API Settings. The stored rows are switched to **PUT** to match the service, and remain editable on the endpoint screen (Details → HTTP method).

**Response handling**

```text
{ "STATUS": "E", "MESSAGE": "Attachment Can Only Be attached By Initiator", "ENFA_NO": "" }
```

- `STATUS` other than `S` is treated as a failure and SAP's own `MESSAGE` is shown in the toast, verbatim — no generic wording.
- On success (`STATUS: "S"`, e.g. `"File upload successfull with ENFA No 100102"`), the toast shows SAP's success message including the returned `ENFA_NO`, and the Attached Docs list re-fetches so the new file appears.
- The Attached Docs dialog shows the same SAP message inline instead of spinning forever if the upload is rejected.

**Network visibility**

The browser continues to call the app's own `/api/public/enfa-upload` route with plain JSON, so both request and response are readable in Inspect → Network. The route echoes SAP's status/latency in `x-sap-status` / `x-sap-latency-ms` headers and returns SAP's `STATUS`, `MESSAGE`, `ENFA_NO` as clean JSON.

## API Settings screen

- The **Upload Document** and **Attached Docs In MY NFA** endpoint rows get the corrected body template (with `user_name`) and method `PUT`, so the Request tab shows exactly what is sent.
- Path, method, headers, query, credentials and the Active flag stay fully editable there and continue to drive the live call.

## Technical notes

- `src/lib/sap-report.server.ts` → `callEnfaUpload`: merge the registered `request_body.upload` template, inject `user_name` (upper-cased resolved username), `reffld` and `file`; keep the dynamic endpoint lookup, large `maxBytes` and long timeout; default method falls back to `PUT`.
- `src/routes/api/public/enfa-upload.ts`: unchanged contract; keep the STATUS/MESSAGE/ENFA_NO extraction and make sure an `E` status returns SAP's message as the error text.
- `src/components/report/RecordAttachmentsDialog.tsx` and `src/routes/_authed.report.tsx`: surface the returned message in the toast/inline error; refresh the SAP documents list on success.
- Migration: update `http_method` to `PUT` and the `request_body` template for the two upload endpoint rows (idempotent, by name).
- No other screens, payloads or behaviour change.
