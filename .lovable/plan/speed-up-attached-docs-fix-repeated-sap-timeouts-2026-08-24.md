# Speed up Attached Docs / fix repeated SAP timeouts

## What the evidence shows

The failing call is `{"attachment":{"reffld":"100105"},"endpoint":"report","mode":"list"}` returning
`{"error":"SAP request failed","status":524}`.

- **524** is not a SAP status and not one of our codes — it is the tunnel/edge in front of the
  on-prem middleware giving up at roughly 100 seconds.
- Our own budget for this call is `timeoutMs: 180_000` and `maxBytes: 20_000_000`
  (`callEnfaAttachments` in `src/lib/sap-report.server.ts`), i.e. larger than the edge allows, so we
  can never see a result that arrives after ~100 s — we just wait and then surface a failure.
- The attachments endpoint returns **every file's full base64 content** in one response, which is why
  it is the one call that regularly exceeds that window.
- The 5-minute cache added earlier lives in module memory of a single serverless instance, so a new
  instance (or a cold start after the failure) repeats the whole slow trip — that is the "repeatedly
  slow" part.

Root cause is therefore two-fold: the SAP payload is too big to fit the edge window, and our cache
does not survive across instances or protect against duplicate concurrent calls.

## What changes for the user

- Attached Docs shows a clear, fast message when SAP is slow instead of hanging then failing.
- Once a record's documents have been fetched successfully, opening Attached Docs for that record is
  instant for any user, on any server instance, for the cache lifetime.
- Repeated clicking / re-opening while a fetch is running no longer starts extra SAP calls.
- Upload, View, Download, endpoint selection (Reports vs My NFAs) and all payload shapes stay exactly
  as they are.

## Technical changes

1. **Fit inside the edge window** (`src/lib/sap-report.server.ts`, `callEnfaAttachments`)
   - Drop the attachment timeout from 180 s to ~85 s so we return our own clear error before the
     tunnel emits 524, and surface "SAP took too long to return the documents" instead of the generic
     "SAP request failed".
   - Map any 5xx/52x tunnel status to that same explanatory message in
     `src/routes/api/public/enfa-attachments.ts`.

2. **Shared, persistent cache** (new table `public.sap_attachment_cache`)
   - Columns: `cache_key` (PK, `endpoint:reffld`), `payload` jsonb (extracted file list incl. base64),
     `status`, `latency_ms`, `fetched_at`.
   - Migration includes `GRANT ALL ... TO service_role` only (written/read solely by the server route
     via the admin client), RLS enabled with no public policies.
   - `enfa-attachments.ts` reads this table first (TTL ~10 min), falls back to SAP, then writes back.
     The existing in-memory cache stays as an L1 in front of it.
   - `refresh: true` (used after upload) deletes both the memory entry and the row.

3. **In-flight de-duplication** (`enfa-attachments.ts`)
   - A module-level `Map<cacheKey, Promise>` so concurrent requests for the same record share one SAP
     round-trip instead of each starting their own.

4. **Fewer sequential round-trips before SAP is contacted** (`callEnfaAttachments`)
   - Run the endpoint lookup, then system load and credential load **concurrently** (`Promise.all`)
     rather than one after another; skip the fallback endpoint query when the exact row is found.

5. **Client resilience** (`src/components/report/RecordAttachmentsDialog.tsx`)
   - Show elapsed-time feedback ("Still fetching from SAP…") after a few seconds and a Retry button on
     failure. No change to how files are listed, viewed, downloaded or uploaded.

## Note

The remaining hard limit is SAP itself: the attachments service returns all file contents in one
response. If it regularly needs more than ~85 s, the durable fix is a SAP-side variant that returns
only filenames/metadata for the list view. Everything above makes our side as fast and as
fault-tolerant as possible without changing the current SAP contract.
