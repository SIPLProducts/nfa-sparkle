## Add a mandatory Designation field to Create User

Department stays as it is: already a required typed field.

### What changes
- Create User gets a new **Designation \*** text box next to Department.
- Clicking Create with Designation empty shows "Designation is required", both as a popup and in red under the field, and the user is not created. The red message goes away once you type something.
- The designation is saved with the user.
- Edit User shows the saved designation and lets you change it. It is optional there, so existing users without one can still be edited.
- The Users list gets a Designation column.
- Nothing else changes: the other fields, roles, login and SAP calls work as before.

### Technical details
- Migration: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation text;`. Existing grants and RLS cover the new column.
- `user-admin.functions.ts` / `user-admin.server.ts` / `api/public/create-user.ts`: add an optional `DESIG` input, write it to `profiles.designation`, and include it in the `listManagedUsers` select and the returned `designation` field.
- `_authed.admin.users.tsx`: add `designation` state and `desigError` to CreateUserDialog, matching the Department check. Add the field to EditUserDialog (optional) and a column to the Users table.
- Production server: the same column has to be added to the Production database with the same SQL.
