# Update Create user form: split name, confirm password, password visibility

## What changes

Update the **Create user** dialog (Admin → User Management → Users) so the name is captured as separate fields and password entry is safer:

1. Replace the single **Full name** field with two required fields: **First name** and **Last name**.
2. Add a **Confirm password** field directly below **Password**.
3. Add a show/hide (eye) icon toggle on both **Password** and **Confirm password** fields.
4. Keep the existing UI design, field order, validation behavior, and functionality unchanged otherwise.

The same name split is applied to the **Edit user** dialog so the two dialogs stay consistent.

## Database

- Migration: add `first_name text` and `last_name text` columns to `public.profiles` (nullable).
- Existing `full_name` stays and is kept in sync as `first_name || ' ' || last_name` so every other screen that reads `full_name` continues to work without changes.

## Backend (`src/lib/user-admin.functions.ts`)

- Extend `ManagedUser` with `first_name` and `last_name`.
- `listManagedUsers` selects and returns the two new columns.
- `createManagedUser`:
  - Accepts `first_name`, `last_name`, and `confirm_password`.
  - Validates that **First name** and **Last name** are provided.
  - Validates that **Confirm password** matches **Password**.
  - Stores `first_name`, `last_name`, and derived `full_name` in `profiles`.
- `updateManagedUser`:
  - Accepts `first_name` and `last_name`.
  - Updates `first_name`, `last_name`, and derived `full_name`.
- `resetManagedUserPassword` is left unchanged.

## UI (`src/routes/_authed.admin.users.tsx`)

- `CreateUserDialog`:
  - Replace the **Full name** input with two full-width inputs: **First name** and **Last name**.
  - Add **Confirm password** input below **Password**.
  - Wrap **Password** and **Confirm password** inputs with an eye-icon button that toggles `type="text"` / `type="password"`.
  - Validate that passwords match before calling the server function.
- `EditUserDialog`:
  - Replace **Full name** with **First name** and **Last name** inputs, populated from the existing user.
- `PasswordDialog` is left unchanged.
- Users table continues to display `full_name`; search already matches `full_name`, so first/last name search works through the derived value.

## Verification

- Open User Management → Users → **Create user**.
- Confirm the form shows First name, Last name, User ID, Employee ID, Department, Email, Password, Confirm password, and Roles.
- Confirm the eye icon toggles visibility for both password fields.
- Confirm mismatched passwords show a validation error and the user is not created.
- Create a user, then open **Edit user** and confirm First name / Last name are populated and editable.
