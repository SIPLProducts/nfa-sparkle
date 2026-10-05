# Fix incorrect “Admins only” message after login

## Confirmed cause

- The signed-in account `prasad.kvvk@sharviinfotech.com` is active and has the `admin` role in the database.
- The User Management screen checks the browser’s loaded role list and redirects when `admin` is absent.
- During login, the authentication provider can process the same session twice concurrently. One path marks access loading complete before the other has finished loading roles, briefly exposing an empty role list and triggering the incorrect “Admins only” popup.

## Changes

1. Make the initial session and role/permission loading atomic so the application never reports access as ready before the current user’s roles are available.
2. Deduplicate overlapping session bootstrap events for the same user without skipping the in-progress access load.
3. Preserve current role tables, permissions, page navigation, SweetAlert messages, and all administrator functionality.
4. Keep genuine non-admin users blocked from User Management and SAP API Settings exactly as they are today.

## Verification

- Sign in with the affected admin account and confirm the Dashboard opens without the incorrect popup.
- Open User Management and SAP API Settings and confirm both remain accessible.
- Confirm a non-admin account still receives the existing “Admins only” message and is returned to the Dashboard.
- Check refresh, token renewal, sign-out/sign-in, and direct navigation to an admin screen without role flicker or redirects.
- Run focused type, build, and browser checks and confirm no runtime errors.

## Scope

No database, role assignment, permission, API, workflow, or visual-design changes.
