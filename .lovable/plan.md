# Clarification email: exclude the person who raised it

## Current behaviour (confirmed in code)
Clarification emails go to the initiator plus every approver from level 1 up to and including the acting level. The person raising the clarification is therefore included. The sender filter is applied only to normal Approve mails.

## Fix
- Recipients for a Clarification email:
  - the initiator;
  - the approvers at levels **before** the raiser, taken from the record's SAP approval chain.
- Exclude the raiser twice over:
  - drop their own chain level;
  - drop any address that matches their Email ID from User Management.
- Recipients are still resolved from the SAP chain plus User Management; no addresses are hardcoded.
- If only the raiser would remain, skip the email and record the reason in the email log.
- Approve, Final Approval, Reject and Back to Initiator stay the same.

## Technical
- In `src/lib/workflow-mail.server.ts`:
  - `pickRecipients` uses `approvers.slice(0, level - 1)` for clarification.
  - `buildWorkflowMail` applies the actor-email filter to clarification as well as to non-final approve.
- Add tests to `src/lib/workflow-mail.test.ts`:
  - level 3 raiser → initiator plus approvers 1 and 2, raiser excluded;
  - level 1 raiser → initiator only.
- Deployment: web only.
