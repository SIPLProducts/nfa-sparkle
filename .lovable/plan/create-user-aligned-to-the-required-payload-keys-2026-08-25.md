# Create user aligned to the required payload keys

## What changes

The Create user form captures exactly the fields in the required payload, and nothing about existing behaviour is removed.

Create user dialog field order:

1. User ID (required) — the login ID, e.g. `SHARVI_RSSPL`
2. First name (required)
3. Last name (required)
4. Email (required)
5. Contact (required) — 10 digits, new field
6. Status (required) — Active / Inactive, new field, defaults to Active
7. Employee ID (EMP_ID)
8. Department (DEPT)
9. Password (required) + Confirm password (required), both with eye toggles
10. Roles (required)

Rules matched to the payload spec:
- User ID up to 12 characters, letters/numbers/dot/underscore/hyphen, stored as typed (uppercase preserved) and unique case-insensitively.
- Password 8–10 characters; Confirm password must match.
- Contact must be 10 digits.
- Status Active/Inactive drives the existing active flag, so the users table and Edit dialog keep working.

Edit user dialog gains the same Contact and Status fields so records can be corrected later. The users list shows Contact and Status alongside the existing details.

## Login

Sign-in keeps working with either User ID or Email plus password — the User ID lookup becomes case-insensitive so `SHARVI_RSSPL` and `sharvi_rsspl` both resolve. No other login behaviour changes.

## Technical details

- Migration: add `contact text` and `status text not null default 'ACTIVE'` to `public.profiles`. Existing profile policies cover the new columns; no policy change needed.
- `normalizeUsername` in `src/lib/user-admin.functions.ts`: keep the entered casing, cap length at 12, keep the character whitelist. Uniqueness check already uses `ilike`, so it stays case-insensitive.
- `resolve_login_email` already compares `lower(username)`, so mixed-case User IDs resolve as-is; no SQL change required there.
- `ManagedUser` gains `contact` and `status`; `listManagedUsers` selects them.
- `createManagedUser` / `updateManagedUser` accept `contact` and `status`, validate contact (10 digits) and password length 8–10, and write them to `profiles` (`is_active` derived from `status === 'ACTIVE'`).
- `src/routes/_authed.admin.users.tsx`: add the Contact input and Status select to both dialogs, reorder Create user fields to match the payload, and show Contact/Status in the table row.
