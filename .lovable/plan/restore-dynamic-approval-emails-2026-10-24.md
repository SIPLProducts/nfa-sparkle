# Restore dynamic approval emails

## What the email log shows (ENFA 100210 / 100211, today)
- Recipients are picked correctly at every level. Initiator approve goes to 9001 (level 1). Then 9002, 9003, 1001, 1002, 1003 and 1004 each get the next mail. Final approval and Back to Initiator go to PRADEEP (the initiator).
- **Every one of these emails failed to send**, initiator mails included, with the same error: "The middleware does not support email yet. Update and restart the middleware."
- That error text no longer exists in the current code. So these actions ran on an **older deployed build**, without today's fixes:
  - the direct mail-server fallback
  - the saved dynamic approver chain
  - the first-approver email when an NFA is created
- No NFA has saved dynamic approvers yet. 100210/100211 were created before the fix, so routing still uses SAP's predefined chain for them.

## Root cause
1. **Delivery:** the running middleware (v1.1.0 on port 3008) is an old copy without the `/mail/send` endpoint, so it answers 404. The deployed website build has no fallback, so every email fails.
2. **Dynamic routing:** the deployed build predates saving the selected approvers. It cannot know the dynamic chain and uses SAP's predefined chain.

## Fix
1. **Deploy the current website build to Quality.** Replace the full `dist`, run the new migration that adds the saved-approver fields, and restart the web process.
2. **Update and restart the middleware** with the repository's `middleware/server.js`, which includes `/mail/send`. Then confirm `GET /health` and that `POST /mail/send` no longer returns 404.
3. **Small code hardening, no workflow change:**
   - Log which delivery path was used (relay or direct) in `email_log.source`, so failures can be pinned down.
   - Add a test for initiator recipients on Final Approval, Reject and Back to Initiator, using a saved dynamic chain.
4. **Verify end to end on Quality** by creating a new Dynamic NFA:
   - the first selected approver gets mail on submission
   - each approval mails the next selected approver
   - final approval, reject and back-to-initiator mail the initiator
   - each step is checked in the email log

## Technical details
- Files: `src/lib/workflow-mail.server.ts` (source tag `mail:relay` / `mail:direct`), `src/lib/workflow-mail.test.ts`.
- Migration: `ALTER TABLE sap_record_draft ADD COLUMN approvers jsonb, approver_mode text` (also added as `deployment/Quality/backend/migrations/9800_draft_dynamic_approvers.sql`).
- Existing NFAs created before this deploy keep using SAP's chain. Only new NFAs get the saved dynamic chain.
