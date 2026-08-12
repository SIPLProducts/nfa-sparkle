# User ID for login + simplified password field

## What changes

### Create user dialog (Admin → User Management → Users)
- New **User ID** field (required), placed above Email. This is the login ID the user types on the sign-in page.
- **Temporary password** is renamed to just **Password**.
- Email stays (required) — it is still the account's real address and is needed for password recovery.
- Validation: User ID must be unique, letters/numbers/dot/underscore/hyphen only, stored lowercase.

### Users table + Edit dialog
- Users list shows the User ID under the name.
- Edit user dialog can change the User ID (with the same uniqueness check).

### Login page
- The existing "User ID" box accepts either the User ID or the email address.
- If it is not an email, the app looks up the matching account server-side and signs in with it. Wrong ID gives the normal "invalid credentials" message.

## Technical details

**Database migration**
- `public.profiles` gains `username text unique` (case-insensitive unique index on `lower(username)`).
- New security-definer function `public.resolve_login_email(_login text) returns text` that maps a username to its email; `execute` granted to `anon` and `authenticated`, returns only the email for an exact username match (never lists or searches emails).

**Server functions** (`src/lib/user-admin.functions.ts`)
- `ManagedUser` gains `username`.
- `createManagedUser` / `updateManagedUser` accept `username`, validate format + uniqueness, and write it to `profiles`.
- `listManagedUsers` returns `username` from `profiles`.

**UI**
- `src/routes/_authed.admin.users.tsx`: add the User ID input to the create and edit dialogs, relabel "Temporary password" → "Password", add the User ID column/subtext to the table.
- `src/routes/auth.tsx`: before `signInWithPassword`, if the entered value has no `@`, call the resolver RPC to get the email, then sign in with that email.
