# Automatic workflow email notifications

## What you get
After SAP confirms an approval action, the app sends an email from the mailbox you enter on the Email Configuration screen. No sender or recipient address is written into the code.

| Action | Who gets the email |
|---|---|
| Approve (more levels left) | The next approver in the chain |
| Approve (last level) | The initiator ("fully approved") |
| Reject | The initiator |
| Back to Initiator | The initiator |
| Clarification | The initiator plus every approver up to and including the one who asked |

- Recipients come from the ENFA's approval chain and initiator. Each User ID is matched to that user's Email ID in User Management.
- Emails go out only when SAP accepts the action. If an email fails, the approval still counts and the user sees no error. The failure is logged on the server.
- If "Enable No-Reply Sending" is off, or the setup is incomplete, nothing is sent.
- If a recipient has no Email ID, they're skipped.

## Email Configuration screen becomes working
- **Save Configuration** stores SMTP Host, Port, Encryption, Username, App Password, From Email, From Name, CC Recipients and the Enable switch on the server. The password is never sent back to the browser. Leaving it empty keeps the saved one.
- **Send Test Email** sends a test message to the address you type.
- The screen loads the saved values when it opens. Layout and fields stay the same.
- Access stays limited to users with SAP API Settings permission.

## What does not change
- SAP payloads, endpoints, approval order, buttons, comments and PDFs stay the same. The app still saves nothing about NFAs locally.

## Technical details
- New table `email_config` (single row, RLS locked; read and written only through server functions guarded by `sap_api` access). The app password goes in the existing locked `sap_secret` table under key `smtp_app_password`. This needs a migration (also added to `deployment/Quality/backend/migrations`).
- `src/lib/email-config.functions.ts`: `getEmailConfig`, `saveEmailConfig`, `sendTestEmail`.
- `src/lib/workflow-mail.server.ts`: resolves recipients and sends mail with `nodemailer` over SMTP.
  - The chain and current level come from the existing SAP approval flow lookup for the ENFA (`sap-approval-flow` logic), with saved `nfa`/`nfa_approver` data as fallback.
  - The initiator comes from `get_print_initiator`.
  - User IDs are mapped to emails through `profiles.username → email` (deleted profiles excluded).
- `src/routes/api/public/enfa-approve.ts`: after a successful SAP result, start the notification without waiting for it (the response is not delayed) and catch any error.
- Plain, readable subject and body: ENFA number, subject, action, acting user, comment, portal link.
- Runtime note: SMTP sending works on your own Quality server (Node). On the hosted Lovable preview it may not be able to open SMTP connections, so testing should be done on your server.
- Update the `AGENTS.md` rule for Email Configuration (it's no longer design-only).
