# Speed up "Attached Docs" fetching

Opening Attached Docs currently waits on one SAP call that returns **every** document's full
base64 content (budget up to 20 MB, 180 s timeout). That whole payload is passed through the
middleware, re-serialised by our proxy route and shipped to the browser before a single filename
appears — so the dialog sits on "Fetching documents from SAP…" for a long time even when the user
only wants to see the list, or view one small file. On top of that, every call re-runs 4–5
sequential database lookups (endpoint row, SAP system, credentials, middleware config) before SAP
is even contacted, and re-opening the same record repeats the entire trip.

Nothing about which endpoint is used, the SAP payload shape, upload, view or download behaviour
changes — only how fast the data arrives.

## What changes for the user

- The document **list** (names, types, sizes) appears as soon as SAP replies; file contents are no
  longer pushed to the browser up front.
- Clicking **View** or **Download** fetches that one file's content on demand — usually instant,
  because it is served from the cached SAP response.
- Re-opening Attached Docs for the same eNFA within a few minutes is immediate (no SAP round-trip).
- **Upload File** still posts to SAP and then refreshes the list — the refresh clears the cache for
  that record so the new file shows up.
- Loading, "no documents in SAP" and SAP error states, plus Reports vs My NFAs endpoint selection,
  stay exactly as they are.

## Technical notes

- `src/routes/api/public/enfa-attachments.ts`
  - Keeps the current auth + extraction logic, but returns files as metadata
    (`{ index, filename, mime, size }`) by default instead of the base64 blobs.
  - Accepts `mode: "list" | "content"` plus `index` — `content` returns the single requested file's
    base64. Also accepts `refresh: true` to bypass the cache after an upload.
  - Adds a small module-scope cache (`Map` keyed by `endpoint + reffld`, ~5 min TTL, capped entry
    count) holding the extracted file array, so `list` and every subsequent `content` request reuse
    one SAP call. Cache misses simply re-call SAP, so correctness is unaffected.
- `src/lib/sap-report.server.ts` (`callEnfaAttachments`): run the endpoint lookup, system load and
  credential load concurrently instead of sequentially, and drop the fallback query when the exact
  endpoint row hits (already the common path). No change to the request body, method, headers,
  `maxBytes` or `timeoutMs`.
- `src/lib/sap-call.server.ts`: fetch the middleware config in parallel with the middleware secret
  rather than one after the other. No behaviour change.
- `src/components/report/RecordAttachmentsDialog.tsx`
  - `useSapDocuments` requests `mode: "list"` and renders from metadata.
  - `openSapDoc` / download first fetch `mode: "content"` for that index (with a per-file loading
    state on the button), then build the blob URL exactly as today; fetched contents are memoised
    per dialog session so viewing then downloading the same file costs one request.
  - `base64ToBlobUrl` decodes in chunks instead of one char-at-a-time loop, so large PDFs/Word files
    stop blocking the UI thread.
  - `refreshSap()` after an upload sends `refresh: true`.
- No schema, migration, API Settings or endpoint-configuration changes.
