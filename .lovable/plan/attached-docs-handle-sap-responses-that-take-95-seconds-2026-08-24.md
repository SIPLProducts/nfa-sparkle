# Attached Docs: handle SAP responses that take ~95 seconds

## What the evidence shows

Your Postman call for `{"attachment":{"reffld":"100105"}}` returns **200 OK, 4.01 MB, in 1 m 34 s**.

The app never gets that far:

- `callEnfaAttachments` (`src/lib/sap-report.server.ts`) sends `timeoutMs: 85_000`, and the on-prem
  middleware aborts the SAP request at that point — that is the `SAP REQUEST ERROR: This operation
  was aborted` line in your middleware log.
- 85 s was chosen deliberately because the hosting edge in front of the app cuts any single request
  at roughly 100 s (the earlier 524 / 504 errors). So simply raising the timeout to 170 s does not
  work either: the browser request dies before SAP answers.

So the response is fine — our request budget is the problem. Records that answer in a few seconds
work; 100105 needs ~95 s and can never fit in one synchronous request.

## The fix

Stop making the browser wait inside one request. Fetch in the background, poll for the result.

1. The dialog asks for the documents. The server checks the shared cache; on a miss it registers a
   job and immediately answers "in progress" (fast, no edge timeout risk).
2. The same server invocation keeps the SAP call running in the background (Cloudflare
   `waitUntil`, which lets work continue after the response is sent) with a 170 s budget, then
   writes the extracted file list into the existing `sap_attachment_cache` table.
3. The dialog polls every ~2.5 s and renders the files as soon as the row appears — typically at
   the ~95 s mark for this record, instantly for cached ones.
4. If the background job fails or exceeds its budget, the job row records the error and the dialog
   shows it with the existing Retry button.

## What changes for the user

- Attached Docs for slow records (like 100105) now finishes and lists the files instead of failing
  with "Request timed out".
- The dialog shows "Fetching documents from SAP…" while waiting — no seconds counter, as you asked.
- Records already cached still open instantly, for any user and any server instance.
- View, Download, Upload, endpoint selection (Reports vs My NFAs) and file-type detection are
  untouched.

## Technical notes

- New table `public.sap_attachment_job`: `cache_key` (PK), `state` (`running` | `done` | `error`),
  `error`, `started_at`, `updated_at`. RLS enabled, `GRANT ALL … TO service_role` only — written and
  read solely by the server route through the admin client. Stale `running` rows older than the
  job budget are treated as failed so a retry can start a fresh fetch.
- `src/routes/api/public/enfa-attachments.ts`: on a cache miss, insert/refresh the job row, start
  the SAP fetch through the request context's `waitUntil` (with a plain fire-and-forget fallback),
  and return `{ pending: true }` with HTTP 202. Existing L1 memory cache, DB cache, envelope
  unwrapping, base64/MIME extraction, `mode: "content"`, `refresh: true` and auth checks stay as
  they are.
- `src/lib/sap-report.server.ts`: `callEnfaAttachments` timeout goes back to `170_000` — it now runs
  outside the browser request, so the edge window no longer applies to it.
- `src/components/report/RecordAttachmentsDialog.tsx`: when the response is 202/`pending`, re-poll
  the same endpoint every 2.5 s (capped at ~4 minutes) instead of erroring. No timer text; the
  existing error + Retry UI handles the failure case.
- The on-prem middleware already honours the `timeoutMs` we send, so no middleware change is
  needed. Its own `TIMEOUT_MS` default only applies when we send none.

## Note

This makes the ~95 s response usable, but the first open of a large record will still take that
long. The durable improvement is a SAP-side list variant that returns only file names/metadata,
with content fetched per file on View/Download — worth requesting from the SAP team.
