# Show saved Departments and Designations as dropdowns in Create / Edit User

## Cause
On Create User and Edit User, Department and Designation are still typed text boxes. They were never connected to the Departments and Designations tabs, so the entries saved there don't show up.

## Change
- Turn Department and Designation into dropdowns on both Create User and Edit User. Each list shows the active entries from the matching tab, sorted by name, and loads fresh every time the window opens.
- Create User: both fields stay required. The "Department is required" / "Designation is required" messages and the rule that blocks saving stay as they are.
- Edit User: the user's current department and designation are already selected. If the saved value is no longer in the list (for example, it was typed by hand earlier), it still appears as a choice so it isn't lost. Both fields stay optional, as now.
- If a list can't load or is empty, the dropdown says so (for example "No departments yet — add them in the Departments tab").
- The saved values don't change: the department/designation name goes out in the same fields (DEPT / DESIG) through the same save calls.

## Technical details
- Only `src/routes/_authed.admin.users.tsx` changes. Add a small `MasterSelect` component that loads `listMasterItems({ kind })` (already used for companies, already permission-checked), keeps only active rows, and renders a shadcn `Select`.
- Swap the four `Input`s for `MasterSelect`. State, validation, and payloads are untouched.
- Nothing changes in the database or server.
- Note: earlier we kept Department as a typed box. This request replaces that with a dropdown.
