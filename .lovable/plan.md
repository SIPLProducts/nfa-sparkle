# Fix: open dialogs and typed data lost when switching to another tab or app

## Root cause (verified in code)

- `src/lib/auth-context.tsx` subscribes to auth state changes with
  `onAuthStateChange((_e, s) => { setLoading(true); void bootstrap(s); })`.
  The auth client re-validates and refreshes the session whenever the browser
  window/tab regains visibility or focus, firing `TOKEN_REFRESHED` /
  `SIGNED_IN` events even though the user never signed out.
- `src/routes/_authed.tsx` renders a full-screen `Loading…` placeholder whenever
  `loading` is true, instead of the app shell and page.

So every time you come back from another tab, Teams, or another window, the auth
provider flips to "loading", the entire authenticated screen tree unmounts, and
React discards every open dialog and every value typed into a form. When it
re-mounts, screens run their mount-time data load again — which looks like an
auto-refresh.

## Changes

1. **`src/lib/auth-context.tsx`**
   - Only enter the `loading` state during the very first session bootstrap.
   - For later auth events, update `session`/`user` in place without touching
     `loading`, and skip the role reload when the signed-in user id is unchanged
     (token refresh, tab focus). Roles reload only when the user actually
     changes or signs in fresh.
   - Sign-out still clears user, roles, and persisted screen state exactly as
     today.

2. **`src/routes/_authed.tsx`**
   - Keep the full-screen loader only for the initial load (no user yet).
   - Once a user is present, never swap the rendered tree for the loader, so the
     shell, the current screen, open dialogs, and typed values stay mounted.

3. **No other behaviour changes**
   - Query client settings stay as they are: no refetch on window focus or
     reconnect; navigating into a screen still refreshes its data.
   - Explicit sign-out, session expiry redirect to `/auth`, permissions, SAP
     calls, validations, and payloads are untouched.

## Validation

- Open a screen, open a dialog, type into a form, switch to another browser tab
  / Teams / another app, come back: dialog is still open, values intact, no
  reload flash.
- Leave the app idle past a token refresh, return: still no reset.
- Navigate to another screen and back: data refreshes as it does today.
- Sign out: redirects to login and clears state.
