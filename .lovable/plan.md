# Add closing signature to ENFA workflow emails

## Goal
Match the Vyapaar sample's closing in every ENFA workflow email (Approve, Final Approval, Reject, Back to Initiator, Clarification).

## Layout (below "You can review this NFA in the eNFA Portal.")
```text
-------------------------------- (thin divider)
Regards,
<Sender name>                    (bold, navy)

   © <current year> <Sender name>. This is an automated notification.   (small grey footer)
```
- Sender name = the "From Name" saved in Email Configuration; if empty, "eNFA Portal". Nothing hardcoded per record.
- The plain-text copy gets the same "Regards, / <Sender name>" lines.
- Subject, recipients, triggers, SAP calls and logging are unchanged.

## Technical
- `src/lib/workflow-mail.server.ts`: `renderWorkflowMailHtml` takes an optional `senderName`; adds divider, signature block and footer (inline CSS, table-safe, escaped). `buildWorkflowMail` reads `fromName` via `loadEmailConfig()` and appends the signature to `text`.
- Add a test that the signature and escaped sender name appear, with the fallback when blank.
- Deployment: web only, no migration.
