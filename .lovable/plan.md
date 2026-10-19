# Fix workflow emails for Approve, Reject, Back to Initiator and Clarification

## What was checked
- **Email settings:** saved and switched on (Gmail, port 587, TLS, App Password stored).
- **Delivery path:** sending is set to go through the middleware. The middleware is online and has the email route, since it answers that route with "secret required", not "not found".
- **Trigger:** all four buttons call the same approval action. An email is started in the background only after SAP accepts the action. Errors are written to the server log only, so failures happen silently and nobody sees them.
- **Recipients:** the Approvals list row from SAP holds approver names. It often has no approver User IDs. User Management stores people by User ID (for example 9001 or 22011077), so names that don't match exactly find no email and nothing is sent. The fix from the last message relies on User IDs that the list row may not contain.

## Root cause still to confirm
These checks don't prove which of these is the real cause on your system:
1. Recipients can't be found because the SAP list row has names but no User IDs.
2. The middleware can't send the mail, for example because its email library is missing or Gmail rejects the login.

Step 1 confirms which one it is before anything else changes.

## Steps
1. **Confirm locally.** Send one test email through the saved settings, using the same middleware path that real approvals use, and record the exact result. Then, for one real ENFA in your Approvals list, work out who each of the four actions would email, without calling SAP.
2. **Get approver User IDs from SAP.** When an approver acts, the app reads that ENFA's approval flow from SAP. The Print Form already uses this same flow, and it includes the User ID for every level. The app then sends those User IDs, plus the names, for all 7 levels with the action. If that lookup fails, it uses the row's own values as today. The approval itself is never delayed or blocked.
3. **Check recipients on the server.** Each User ID or name is matched to an Email ID in User Management, ignoring upper or lower case. Deleted users are skipped. The rules for who gets each email stay the same:
   - Approve with more levels left: the next approver
   - Final approve: the initiator
   - Reject: the initiator
   - Back to Initiator: the initiator
   - Clarification: the initiator plus every approver up to the one who asked
4. **Show what happened to each email.** Every email attempt is recorded with the ENFA number, action, intended people, resolved Email IDs, and the result: sent, failed with the reason, or skipped because no Email ID was found. The Email Configuration screen gets a small "Recent email activity" list, so you can see why an email didn't arrive without reading server logs.
5. **Test all four actions locally** with the real chain, for example the IT ITEMS chain (9001, 9002 and 9003, all with Email IDs). Send one real email per action to the correct recipients, then report the results for each case.

## Not changing
SAP payloads and endpoints, approval order, buttons, comments, PDFs, Print Form, the email settings fields, and every other screen.

## Technical details
- `_authed.approvals.tsx`: before posting `/api/public/enfa-approve`, call `fetchResolvedSapApprovalFlow` (plant, NFA type, function from the row) with a short timeout. Build `notify.approvers[level] = [userId, name, APPRn]` for levels 1-7. Build `notify.initiator` from INIT_USERID/USNAM/INIT_NAME.
- `workflow-mail.server.ts`: return a structured result `{status, people, to, error}` from `notifyWorkflowAction`, write it to a new locked table `email_log` (RLS on, no client policies, written by the server admin client), and add `listEmailLog` to `email-config.functions.ts`, guarded by `sap_api`.
- Migration for `email_log`, also copied to `deployment/Quality/backend/migrations`.
- `_authed.admin.email.tsx`: read-only "Recent email activity" table (last 20 rows).
- Tests: extend `workflow-mail.test.ts` for the flow-derived User IDs and all four actions.
