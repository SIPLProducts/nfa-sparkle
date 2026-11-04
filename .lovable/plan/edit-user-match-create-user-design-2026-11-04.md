# Edit User: match Create User design

Restyle only the Edit User dialog so it looks like Create User. Nothing about saving changes.

## What changes
- Same wide window (rounded, header icon, title "Edit user" with the user's email as subtitle, close X, scrollable body, footer bar with Cancel / Save changes).
- Same two-column grid, in the same order as Create User:
  User ID | Status, First name | Last name, Email | Contact, Company | Department, Designation | Role.
- Same label style with red required stars on the fields Edit already requires (User ID, Status, First/Last name, Email, Contact, Role). Company, Department, Designation keep their current optional behavior (label stays "Company Name" via the existing field) — no new validation.
- Password fields are not added (Edit uses the separate Reset password action).

## What stays the same
- Existing user values still load into every field when Edit opens (already loaded from the user list: name, User ID, email, contact, status, company, department, designation, role).
- Save payload, role check, update call, success message and closing behavior are untouched.

## Technical
- In `src/routes/_authed.admin.users.tsx`, replace the `Dialog/DialogContent` markup of `EditUserDialog` with the same custom overlay/container markup used by `CreateUserDialog` (return null when no user). State, useEffect population and `submit` unchanged.
