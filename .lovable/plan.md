# Make workflow emails work and test them locally first

## Goal
Get the test email and all five workflow emails working on the local copy of the app (this workspace runs the app as a normal server, which can reach Gmail). Nothing goes to Quality until every case passes. Approvals, SAP calls, PDFs and the other screens stay the same.

## Steps
1. **Test email locally.** Send a test with your saved Gmail settings (smtp.gmail.com, 587, TLS, full Gmail address as Username, 16-character App Password). Fix the connection settings so port 587 upgrades to encryption the normal way, as your Vyapaar Portal does, instead of forcing it. Port 465 / SSL keeps working too.
2. **Clearer error messages.** Turn mail server errors into plain messages, for example "Gmail rejected the username or App Password", "Cannot reach the mail server" or "This server cannot send email (hosted preview)".
3. **Check who gets each email**, using real approval data from SAP:
   - Approve, more levels left: the next approver
   - Approve, last level: the initiator ("Fully approved")
   - Reject: the initiator
   - Back to Initiator: the initiator
   - Clarification: the initiator plus every approver so far
   The initiator and approver names from SAP are matched to Email IDs in User Management. If the initiator name is a full name rather than a User ID, use the record's saved initiator as a backup. Skip anyone with no Email ID and note it in the log.
4. **Dry-run check.** Add a test mode that works out the recipients and the email text for each action without calling SAP. That lets us confirm all five cases locally without changing real NFAs. After that, send one real email per case to your test address.
5. **Logging.** Write one short line to the server log for each email: ENFA number, action, recipients, and whether it was sent or failed. No passwords are logged.
6. **Report back** with the results of each case. Deploy to Quality only after you confirm.

## Not changing
SAP payloads, endpoints, approval order, buttons, comments, Print Form and PDFs. If an email fails, the approval still goes through.

## Technical details
- `workflow-mail.server.ts`: TLS option → `secure:false` without `requireTLS` for 587 (STARTTLS opportunistic), `secure:true` for 465; map nodemailer `code` (EAUTH, ECONNECTION, ETIMEDOUT, ESOCKET) to readable messages; add `previewWorkflowMail()` (pure recipient + body build), structured log line.
- Initiator fallback via existing `get_print_initiator` / saved `nfa` when `INIT_NAME` does not match a profile.
- Unit tests for `pickRecipients` covering all five cases plus last-level detection.
- Local verification: run `sendTestMail` and the dry-run against the dev server with a signed-in session.
