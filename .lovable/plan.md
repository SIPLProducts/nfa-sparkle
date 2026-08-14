# Add Employee ID and Department to user creation

## What changes
The Create user dialog gets two new optional fields, placed after User ID:

- Employee ID — free text
- Department — free text

Everything else in the dialog (Full name, User ID, Email, Password, Roles) stays exactly as it is.

These values are saved with the user, shown on the Edit user dialog so they can be corrected later, and displayed in the users table under the user's name so admins can scan them at a glance. They are also searchable from the existing search box.

## Technical details
- Migration: add `employee_id text` and `department text` columns to `public.profiles` (both nullable). No policy changes needed — existing profile policies cover them.
- `src/lib/user-admin.functions.ts`:
  - extend `ManagedUser` with `employee_id` and `department`
  - `listManagedUsers` selects and returns the two columns
  - `createManagedUser` accepts optional `employee_id` / `department`, trims them, stores `null` when blank
  - `updateManagedUser` accepts and updates the same two fields
- `src/routes/_authed.admin.users.tsx`:
  - `CreateUserDialog` and `EditUserDialog` get the two inputs and pass them through
  - users table shows Employee ID / Department under the name when present
  - search filter also matches on employee ID and department
