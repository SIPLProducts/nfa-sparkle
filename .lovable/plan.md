# Email notifications without storing email IDs in the Approval Chain

## Answer

Yes — fully possible. The Approval Chain keeps only the SAP User IDs it already has (USERID1…7). The email address of each receiver is resolved dynamically at send time from the user profile records, by matching the SAP User ID to the user's profile User ID and reading that profile's email. No email column is added to the chain, and no email is hardcoded anywhere.

## How recipients are resolved (all dynamic)

```text
SAP User ID (from NFA / approval chain)
        │
        ▼
profiles.username  ──match──▶  profiles.email
        │
        ▼
   receiver address
```

- **Back to Initiator** → Initiator's User ID from the NFA record (`INIT_USERID`) → profile email
- **Rejected** → Initiator's User ID → profile email
- **Approve (intermediate level)** → next level's User ID from the active approval chain (USERID at level N+1) → profile email
- **Final Approve** → Initiator's User ID → profile email
- **Sender** → always `System.Notification@ramky.com`, from the Email Configuration screen

If a user has no email on their profile, that notification is skipped and logged — the approval action itself is never blocked.

## What gets built

1. **Email Configuration screen** (`/admin/email-config`, Admin sidebar, role-gated like SAP API Settings)
   - SMTP host, port, encryption (TLS/SSL), sender email (`System.Notification@ramky.com`), sender display name, SMTP username, app password (masked), master on/off toggle
   - "Send Test Email" button with SweetAlert feedback

2. **Database table** `public.email_settings`
   - Stores the SMTP configuration above; readable/writable only by authorized administrators; app password never exposed to the browser

3. **Email dispatch service** (server-side)
   - Runs only after SAP confirms the action succeeded (Approve / Reject / Back to Initiator / Clarification unchanged unless requested)
   - Resolves the receiver as above, renders the template (eNFA number, subject, company, action taken by, remarks, portal link), sends via SMTP with the app password
   - Non-blocking: mail failures never roll back or delay the approval; each send is recorded in an `email_logs` audit table

4. **User ID → email lookup**
   - Reuses the existing profile records; the Edit User dialog already maintains each user's Email ID, so keeping profiles up to date keeps notifications correct automatically

## What does not change

- Approval Chain screens and SAP payloads (create_user / Update_user / delete_user) — no email fields added
- Approve / Reject / Back / Clarification workflow logic and SAP calls
- Any existing screen, permission, or print/preview functionality

## Verification

- Focused tests for recipient resolution (initiator vs next approver vs final approve) and template rendering
- Build check, then a Test Email from the configuration screen on the server
- One real approval action on Quality to confirm the receiver gets the mail
