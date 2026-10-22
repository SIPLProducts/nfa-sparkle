# Styled workflow emails (match Vyapaar sample)

## Goal
Replace the plain-text ENFA workflow mails with a branded HTML layout like the sample: dark navy header band with small "NOTIFICATION" label and a title, greeting, intro sentence, a light rounded details card with label/value rows, and a closing support line.

## Layout
```text
[ navy header ]  NOTIFICATION
                 <Action title>  e.g. "Awaiting Your Approval", "NFA Fully Approved", "NFA Rejected", "Sent Back to Initiator", "Clarification Requested"
Dear <recipient name>,          (one recipient) / "Dear Sir/Madam," (several)
<intro sentence per action, ENFA no. in bold>
[ details card ]
  ENFA No        100183 (bold, monospace)
  Subject        test3
  Action         Clarification requested
  Action By      <actor name> (<User ID>)
  Level          2 (when known)
  Comment        please check  (or —)
  Action Date    22 Oct 2026, 11:29 am (IST)
You can review this NFA in the eNFA Portal.
```
- Mail subject stays `ENFA <no> — <heading>`.
- All values come from the existing workflow data; nothing hardcoded per record. Missing values show "—".
- A plain-text version is still sent alongside, for mail clients that block HTML.
- Recipients, triggers, SAP calls and logging are unchanged.

## Technical
- `src/lib/workflow-mail.server.ts`: add a pure `renderWorkflowMailHtml()` (inline CSS, table-based for Outlook, values HTML-escaped); `buildWorkflowMail` returns `html` too; `sendMail` passes `html` + `text`. Recipient display names resolved from the same profile lookup already used for emails.
- Actor shown as profile name + User ID when available.
- Add a test asserting escaping and that ENFA no./comment appear; existing mail tests kept.
- Deployment: web only, no migration.
