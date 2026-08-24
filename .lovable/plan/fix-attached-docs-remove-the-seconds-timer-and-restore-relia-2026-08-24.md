# Fix Attached Docs: remove the seconds timer and restore reliable document opening

## What the evidence shows

- The dialog shows an elapsed counter ("Still fetching documents from SAP… (85s)", "(376s)") because
  `RecordAttachmentsDialog.tsx` runs a 1-second interval while loading.
- 376 seconds is longer than any SAP call we make: `callEnfaAttachments` in `src/lib/sap-report.server.ts`
  uses `timeoutMs: 170_000`. So the client is not waiting on one call — it is stuck in the polling loop
  added in the last change.
- That loop depends on a **background job kept in module memory** of the API route
  (`inFlight` / `failures` / `cache` maps in `src/routes/api/public/enfa-attachments.ts`). On the serverless
  runtime the work is not guaranteed to continue after the response is sent, and the next poll can land on a
  different instance where `inFlight` is empty — so each poll starts over and the client never gets files.
  This is why documents that opened fine before now never appear.

## What changes for the user

- No more seconds counter — just "Fetching documents from SAP…".
- Attached Docs loads the list in a single request again, the way it did when it worked, and View/Download
  open Word, PDF, Excel, images and text as they do today.
- If SAP genuinely fails or is too slow, a short error line with a **Retry** button appears instead of an
  endless spinner.
- Upload File, endpoint selection (Reports vs My NFAs), the file-type viewer and the cached results all stay
  exactly as they are.

## Technical changes

1. `src/routes/api/public/enfa-attachments.ts`
   - Remove the 202/`pending` background-job path: `inFlight` de-duplication and the `failures` map plus the
     `WAIT_MS` race. The handler awaits the SAP call and returns the result (or the error) in that same request.
   - Keep the in-memory L1 cache and the shared `sap_attachment_cache` row (both already work), keep
     `mode: "list" | "content"`, `index`, and `refresh: true`.
   - Keep returning a clear message for tunnel/5xx statuses instead of the generic failure text.

2. `src/lib/sap-report.server.ts` (`callEnfaAttachments`)
   - Lower `timeoutMs` from 170 s back to ~85 s so we answer inside the edge window with our own message
     rather than being cut off. No change to the payload, endpoint resolution, method, headers or `maxBytes`.

3. `src/components/report/RecordAttachmentsDialog.tsx`
   - Delete the `elapsed` state, its interval effect and the "(Xs)" text; the loading line reads
     "Fetching documents from SAP…".
   - Drop the polling loops in `useSapDocuments` and `fetchSapDocContent` (no more 202 handling) — one request,
     then success or an error with Retry.
   - No change to `SapDocViewer`, the MIME/byte sniffing, or upload/download behaviour.

No schema, migration, API Settings or endpoint-configuration changes.
