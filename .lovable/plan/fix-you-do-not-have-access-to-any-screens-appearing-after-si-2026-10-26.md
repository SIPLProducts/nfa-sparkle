# Fix "You do not have access to any screens" appearing after sign-in

## Root cause
When a user signs in (or the session refreshes to a different user), the app marks the user as signed in immediately, but their roles and screen permissions are still being loaded in the background. For that moment the app sees "signed in, but no roles" and the Dashboard shows "You do not have access to any screens."

Two things make it stick instead of flashing:
- If the roles or permissions request fails or is slow (network blip, session token not ready yet), the app silently treats the user as having no roles and never tries again.
- The Dashboard ignores the load error, so it shows the "no access" message instead of a retry option. Only a manual page reload recovers.

## Fix
1. Track an "access loading" state that stays on from the moment a user is set until their roles and permissions have finished loading — for first load, sign-in and user switches (not for routine token refreshes).
2. While access is loading, the Dashboard and protected screens show "Loading…" instead of any access decision.
3. If loading fails, retry automatically (up to 3 times with a short pause). If it still fails, show "Unable to load your access" with a Retry button instead of "You do not have access".
4. "You do not have access to any screens" is shown only when the load succeeded and the user truly has no permitted screen.
5. No change to roles, permissions, login, redirects to the first permitted screen, APIs or workflows.

## Verification
- Add a small test for the access decision: loading → wait; error → retry message; loaded with no roles → no-access message; loaded with roles → first permitted screen.
- Sign in through the preview as an approver-only and an admin user, reload repeatedly, and confirm each lands on their permitted screen with no "no access" message.
- Confirm in the database that the affected user has a role assignment (if they have none, the message is correct and the admin must assign one).

## Technical details
- `src/lib/auth-context.tsx`: add `accessLoading` (set true before `Promise.all([loadRoles, loadPermissions])` when `!sameUser`, false after); make `loadRoles`/`loadPermissions` return success, retry with backoff; expose `retryAccess()`.
- `src/routes/index.tsx` and the `_authed` layout guard: treat `loading || accessLoading` as loading; render the `accessError` + Retry state before the no-access message.
- After deployment, update the website on Quality and restart the web process.
