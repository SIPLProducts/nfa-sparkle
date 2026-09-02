# Rename Employee ID to Company Name in Create User

## What changes

In the User Management → Create user dialog only:

- The field label changes from **Employee ID** to **Company Name**.
- The placeholder changes from `EMP-1024` to `Company name`.

Everything else stays exactly as it is:

- The payload key sent to the server remains `EMP_ID` — request body and response are unchanged.
- The value is still saved to the existing `employee_id` column; validation, trimming, and null-when-blank behavior are untouched.
- Field position (after Status, before Password), layout, required/optional state (optional), and all other fields are unchanged.
- The Edit user dialog is untouched.

## Technical details

- `src/routes/_authed.admin.users.tsx` (Create dialog, ~line 533): change `<Label>Employee ID</Label>` to `<Label>Company Name</Label>` and the input placeholder to `Company name`. State variable name `employeeId` and the `EMP_ID: employeeId` payload line stay as-is.

## Verification

- Open User Management → Create user and confirm the field shows "Company Name" with the new placeholder.
- Create a user and confirm the Network payload still sends `EMP_ID` with the entered value.
