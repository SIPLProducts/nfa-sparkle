# Designations and Departments tabs in User Management

## What you will see
- Two new tabs, **Departments** and **Designations**, placed right after **Roles**.
- Each tab works like Roles: a list table, a **Create** button, **Edit** and **Delete** actions per row (delete asks for confirmation), plus a **View** action that opens a read-only details window.
- Fields per entry: Name (required, unique), Code (optional), Description (optional), Active on/off, created/updated dates shown in View.
- Same access rule as the rest of User Management: users with the User Management screen permission can manage them.

## What stays the same
- Users, Roles, Permissions, Approval Chain and Dynamic tabs are untouched.
- Create User / Edit User keep their current Department and Designation text boxes, validations and saving. Existing user data is not changed.

## Technical details
- New tables `departments` and `designations` (id, name unique case-insensitive, code, description, is_active, timestamps) with GRANTs, RLS: authenticated can read; writes only through server functions.
- New server functions (list/create/update/delete) in `user-admin.functions.ts` / `.server.ts`, guarded by the existing User Management screen-access check, mirroring the role-def functions.
- New `DepartmentsTab` and `DesignationsTab` components (shared generic master-list table + dialog) added to `_authed.admin.users.tsx`; SweetAlert confirm/toasts as in Roles.
- Production note: the same table SQL must be run once in the Production Studio SQL Editor before deploying.
- Optional follow-up (not included): turn Create User's Department/Designation boxes into dropdowns fed by these lists.
