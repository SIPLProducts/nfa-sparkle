# Permission-based access for all application screens

## Goal
Make every application screen open and work according to the screen permissions assigned to a user's Custom Role. A user granted a screen receives that screen's existing capabilities, while users without permission remain blocked.

## Changes
- Use the existing role-to-screen permission matrix as the single source of access for all seven screens: Dashboard, Create NFA, My NFAs, Approvals, E-NFA Report, SAP API Settings, and User Management.
- Replace the outdated Admin-only page checks on User Management, SAP API Settings, and SAP API detail pages with their assigned screen permission checks.
- Keep access checks pending until roles and permissions finish loading, avoiding false redirects during sign-in or refresh.
- Add a shared server-side screen-permission check and apply it to every User Management and SAP API operation, including Approval Chain actions. This ensures opening a permitted screen also enables its existing load, create, edit, test, save, and delete actions.
- Preserve the existing Custom Admin safety rule that prevents removing its User Management access. Do not change role assignments, saved permissions, users, SAP settings, or business data.
- Keep workflow-specific controls unchanged: Approvals behavior still follows the user's workflow role, and granting an unrelated screen does not grant unrelated workflow authority.
- Add the task to the project roadmap and document the permission-based authorization rule for future changes.

## Verification
- Test a non-admin Custom Role granted User Management and SAP API Settings: both list and detail screens open without “Admins only,” and their existing actions work.
- Confirm removing either permission hides and blocks that screen.
- Confirm Custom Admin access and all non-admin screens continue working unchanged.
- Run focused tests and verify the application build is healthy.
