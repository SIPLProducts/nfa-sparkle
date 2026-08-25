# Create User & Login use the exact SAP-style payload keys

## What changes

### Create user
The Create user request body sent over the wire will be exactly:

```json
{
  "USER_ID": "SHARVI_RSSPL",
  "FIRST_NAME": "SAI",
  "LAST_NAME": "SAMPATH",
  "EMAIL": "sampath@sharviinfotech.com",
  "STATUS": "ACTIVE",
  "CONTACT": "9876543212",
  "PASSWORD": "",
  "CONFPWRD": "",
  "ROLE": "",
  "EMP_ID": "",
  "DEPT": ""
}
```

- `ROLE` is sent as a comma-separated string of the selected role keys (e.g. `"initiator,approver"`).
- The same key set is used for Edit user (plus the internal record id), so both paths stay consistent.
- Opening Inspect → Network → the create-user request shows exactly this JSON payload.
- No visible form or validation behaviour changes: fields, order, required rules, 10-digit contact, 8–10 char password, confirm match, Active/Inactive all stay as they are.

### Login
- Sign-in keeps accepting **User ID or Email** plus password.
- The login lookup request sends `{ "LOGIN_ID": "SHARVI_RSSPL" }` (uppercase key) so it is recognisable in Network; the password is then verified by the auth service as today.
- User ID matching stays case-insensitive; email login is unchanged.

## Technical details

- `src/lib/user-admin.functions.ts`
  - `createManagedUser` input validator/handler switch to the uppercase keys above; internally map to the existing profile columns (`username`, `first_name`, `last_name`, `email`, `status`, `contact`, `employee_id`, `department`) and roles array (`ROLE` split on commas, trimmed, empties dropped).
  - `updateManagedUser` takes the same uppercase keys plus `ID`.
  - Validation messages and rules unchanged (`normalizeUsername`, `normalizeContact`, `normalizeStatus`, password 8–10, confirm match, at least one role).
  - `resetManagedUserPassword` and `setManagedUserActive` untouched.
- `src/routes/_authed.admin.users.tsx`
  - `CreateUserDialog` / `EditUserDialog` build the uppercase payload object and pass it to the server functions; local state and inputs unchanged.
- `src/routes/auth.tsx`
  - Replace the direct `resolve_login_email` RPC call with a small POST that sends `{ LOGIN_ID }` and returns the resolved email (calling the same security-definer lookup server-side), then sign in with email + password as today.

## Verification

- Admin → User Management → Users → Create user: submit and confirm the Network payload matches the JSON above key-for-key.
- Sign in with `SHARVI_RSSPL` and with the email address; both succeed.
