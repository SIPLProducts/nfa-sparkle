# Welcome email + Set Password flow for new users

## What the user will see
1. Admin creates a user in User Management (form, fields and validations unchanged).
2. Right after the user is saved, an email goes to the new user's email address, sent from the sender set in **Email Configuration**.
3. The email (Anumati / ENFA branded, logo, brand colours, mobile-friendly) contains:
   - Welcome to the ENFA Portal (Anumati), with the user's name
   - Their **User ID** and registered email
   - A clear **Set Password** button (plus a plain link as backup)
   - A note that the link is personal and expires
4. Clicking **Set Password** opens the portal's password screen with two fields: **New Password** and **Confirm Password**, and a **Submit** button.
5. After a successful update, the user is taken to the **ENFA Login** page with a success message, and can sign in using their User ID or email and the new password.

## Behaviour rules
- User creation never fails because of email: if email is off or sending fails, the user is still created and the admin sees a warning ("User created, but the welcome email could not be sent").
- Every attempt is recorded in the email log (action `user_welcome`).
- Link uses the portal's current address (e.g. https://anumati.ramky.com), same as Forgot Password.
- Existing Forgot Password, Reset password button, login, roles, ranges and SAP payloads stay unchanged.

## Technical details
- `src/lib/user-admin.server.ts` (`createManagedUserForAdmin`): after the auth user + profile are created, call a new `sendUserWelcomeMail` wrapped in try/catch; return `{ ..., welcomeEmail: "sent" | "skipped" | "failed" }`.
- Link: `supabaseAdmin.auth.admin.generateLink({ type: "recovery", email })` → hashed token → `resetPasswordLink(base, hashed)` reused from `src/lib/reset-link.ts`, with an extra `welcome=1` query flag; base from `portalBaseUrl` using request headers (as in `password-reset.functions.ts`).
- `src/lib/workflow-mail.server.ts`: add `sendUserWelcomeMail(email, link, { name, userId })` using `loadEmailConfig` and the existing transport (relay/SMTP) and `email_log` writing; new HTML builder in `src/lib/welcome-email-template.ts` (table-based, inline styles, 600px max, logo via absolute portal URL).
- `src/routes/reset-password.tsx`: when `welcome=1`, show title "Set your password"; fields New/Confirm Password; on success `signOut()` then navigate to `/auth` with a success toast. Existing reset mode unchanged.
- `src/routes/_authed.admin.users.tsx`: show success/warning based on `welcomeEmail`.
- Tests: template contains User ID, name and the link; link builder adds `welcome=1`; email failure does not fail user creation.
- No database migration needed.
