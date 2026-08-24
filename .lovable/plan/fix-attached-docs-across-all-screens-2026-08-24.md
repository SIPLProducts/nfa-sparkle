# Fix Attached Docs across all screens

## Root cause (verified in code)

`src/routes/api/public/enfa-attachments.ts` currently answers every cache miss with
HTTP 202 `{ pending: true }` and tries to finish the SAP call *after* the response is sent
(`runAttachmentJob` + `keepAlive`). On the serverless runtime that background work is not
kept alive — the handler's `context` exposes no `waitUntil`, so the code falls through to
plain fire-and-forget, which is cancelled when the request ends.

Consequences, matching what you see on every screen:

- The SAP call is aborted mid-flight, so nothing is ever written to `sap_attachment_cache`.
- The `sap_attachment_job` row stays `running` for 200 s, so each poll is told "still running"
  and no new attempt is started.
- The dialog sits on "Fetching documents from SAP…" forever, for fast records too.

This is a regression from the background-job change; before it, documents loaded in one request.

## The fix

Go back to a single request that actually waits for SAP, keeping every caching layer that works.

1. `src/routes/api/public/enfa-attachments.ts`
   - Remove the 202/pending path, the `inFlight` map, `keepAlive`, `runAttachmentJob` and all
     `sap_attachment_job` reads/writes.
   - On a cache miss the handler awaits `callEnfaAttachments`, extracts the files, writes both the
     in-memory cache and the shared `sap_attachment_cache` row, and returns the list in that same
     response; SAP errors return a clear message (tunnel/5xx wording kept).
   - `mode: "list" | "content"`, `index`, `refresh: true`, auth check, envelope unwrapping and
     base64/MIME sniffing are unchanged.
2. `src/lib/sap-report.server.ts` — `callEnfaAttachments` timeout back to `85_000`, so we answer
   with our own readable message just inside the ~100 s edge window instead of being cut off.
3. `src/components/report/RecordAttachmentsDialog.tsx`
   - Drop the 202/pending polling loops in `useSapDocuments` and `fetchSapDocContent`; one request,
     then the list or an error line with the existing **Retry** button.
   - Loading text stays "Fetching documents from SAP…" (no timer).

No changes to Upload File, endpoint selection (Reports vs My NFAs), the viewer, or API Settings.
The `sap_attachment_job` table is simply left unused (no migration needed).

## After this fix

- Attached Docs works again on E-NFA Report, My NFAs and Approvals for all records SAP answers
  within ~85 s, and cached records open instantly for everyone.
- Records where SAP genuinely needs ~95 s (e.g. 100105) will still report a timeout with Retry.
  Making those work reliably needs the wait to happen somewhere that stays alive — the on-prem
  middleware (`middleware/server.js`) is the right place: add a start/poll job pair there so it
  holds the long SAP call and the app polls it. I can plan that as a follow-up if you want it,
  since it requires redeploying the middleware on your server.
