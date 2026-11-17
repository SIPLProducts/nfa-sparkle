# Close Create User and refresh the Users list after creation

## Problem
When a user is created, the "User created successfully" message appears, but the Create user form stays open with the old values, so the new user doesn't show up in the list behind it.

## Fix
- When creation succeeds: show the success message, close the Create user form and reload the Users list right away, so the new user appears in the table.
- If creation fails, the form stays open with the entered values and the error message (same as now).
- Opening Create user again still starts with an empty form (same as now).
- Validation, the values sent to SAP, Edit User and the password reset don't change.

## Technical details
- `src/routes/_authed.admin.users.tsx`, CreateUserDialog `onSubmit` handler in the parent: after a successful response, call `setCreateOpen(false)` and `await qc.invalidateQueries({ queryKey: ["managed-users"] })`. This also refetches the list, which currently has `staleTime: 60_000`.
