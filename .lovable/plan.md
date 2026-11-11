# Forgot Password with portal email settings and dynamic link

## What the user will see
- **Login page**: "Forgot password?" opens a small window asking for User ID or Email, with a "Send reset link" button.
- After sending, it always shows: "If this account exists, a reset link has been sent to its registered email." (does not reveal whether an account exists).
- **Email**: sent from the From Email / From Name saved in Admin → Email Configuration, using the same SMTP settings (and the same on-prem middleware relay) as workflow emails. Styled like existing workflow emails.
- **Reset link**: built from the address the user is currently using, e.g.
  - `http://10.200.1.7:8081/reset-password?...` (Quality)
  - `http://10.200.1.7:9001/reset-password?...` (Production internal)
  - `https://anumati.ramky.com/reset-password?...` (Production public)
- **New Reset Password page**: enter new password + confirm (same password rules as Create User), then returns to Login with a success message. Expired/used links show a clear message and a link back to Forgot password.

## Not changed
Sign-in, user management, workflow emails, Email Configuration screen, SAP integrations.

## Technical details
- New public server function `requestPasswordReset({ login })` in `src/lib/password-reset.functions.ts`:
  - Resolves User ID → email server-side from `profiles` (admin client, never returned to browser).
  - Base URL from request headers: `X-Forwarded-Proto` + `X-Forwarded-Host`/`Host` (falls back to `Origin`), normalized to `scheme://host[:port]`. Works behind Nginx for all three addresses.
  - `supabaseAdmin.auth.admin.generateLink({ type: "recovery", email })` → use `hashed_token` to build `${base}/reset-password?token_hash=…&type=recovery` (avoids depending on auth redirect allow-lists per environment).
  - Sends via a new `sendPasswordResetMail(to, link)` in `workflow-mail.server.ts` reusing the existing `transport()`; logs to `email_log` with action `password_reset`.
  - Generic response always; simple per-login throttle (one request / 60s) to prevent abuse.
- New route `src/routes/reset-password.tsx` (public): `supabase.auth.verifyOtp({ token_hash, type: "recovery" })`, then `supabase.auth.updateUser({ password })`, sign out, navigate to `/auth`.
- Nginx: ensure `proxy_set_header Host $host` and `X-Forwarded-Proto $scheme` exist in Quality/Production configs (documented; repo configs updated if missing).
- Tests: base-URL builder (forwarded headers, ports, https domain) and link format.
- Requires Email Configuration to be enabled and filled in each environment; otherwise the dialog shows "Password reset email is not configured. Contact administrator."
