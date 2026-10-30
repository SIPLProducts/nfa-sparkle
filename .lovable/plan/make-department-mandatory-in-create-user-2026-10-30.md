## Make Department mandatory in Create User

Only the Create User dialog changes. Edit User and everything else stay as-is.

- Label changes to "Department *".
- On Create, if Department is empty (or only spaces), show the error message "Department is required" (same popup style as the other checks) and below the field in red, and do not submit.
- The inline message clears as soon as the user types a department.

Technical: in `src/routes/_authed.admin.users.tsx` CreateUserDialog `submit()`, add a `department.trim()` check before `setBusy`, plus a small `deptError` state shown under the Input; reset it when the dialog opens.
