# Add an editable Email ID field to the Edit user dialog

## Confirmed current behavior

- The Edit user dialog (User Management → Users → Edit) shows the email only as small subtitle text under the title — there is no Email ID input field.
- The user's email is already loaded with each row (`ManagedUser.email`) and is already sent in the save payload as `EMAIL: user.email`, but the server update currently ignores it.

## Plan

1. Add an **Email ID *** input to the Edit user dialog, placed below User ID, pre-filled with the selected user's existing email (dynamic from the loaded row — nothing hardcoded).
2. On Save changes, send the edited email in the existing `EMAIL` payload key.
3. In the existing `updateManagedUser` server function, when the email changed:
   - Validate format and that no other account already uses it (clear error message if taken).
   - Update the account's sign-in/recovery email and the profile email so login, password recovery, and the Users table all show the new address.
4. If the email is unchanged, saving behaves exactly as today.
5. Verify: edit a user, change the email, save, confirm the Users table and a reopen of the dialog show the new email; confirm saving without touching the email still works; build stays clean.

## Scope

Edit user dialog + its existing save path only. No changes to Create user, Password, Activate/Deactivate, Delete, roles, permissions, or any other screen. No database schema changes.

## Technical details

- `src/routes/_authed.admin.users.tsx`: add `email` state to the Edit dialog, initialize from `user.email`, render the Email ID input, pass it as `EMAIL` in the submit payload.
- `src/lib/user-admin.functions.ts` (`updateManagedUser`): validate/normalize `EMAIL`; when different from the current one, call `db.auth.admin.updateUserById(id, { email })` and update `profiles.email`; surface a friendly error if the email is already registered.
