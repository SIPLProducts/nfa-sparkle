# Add a Companies tab to User Management

## What you'll see
- A new **Companies** tab in User Management, right after Designations.
- It works the same way as the Departments and Designations tabs:
  - a search box and a **Create Company** button
  - a list with **Company Name** and **Description**
  - **View**, **Edit** and **Delete** on each row, with a confirmation before deleting
- Company names must be unique, ignoring capital letters.
- Only users who can open User Management can use the tab.

## What stays the same
- Every existing tab and the Create User and Edit User forms.
- The Company field on users keeps coming from SAP, as it does today. The new list is managed on its own and isn't linked to that field.

## Technical details
- Add a new companies table with the same structure, permissions and update timestamps as departments and designations. Signed-in users can read it; all changes go through server functions protected by User Management access.
- `src/lib/master-lists.functions.ts`: add `"companies"` to `MasterKind` and to the allowed-list check. The existing create, read, update and delete functions are reused.
- `src/routes/_authed.admin.users.tsx`: add the trigger and content for the new tab, using `<MasterListTab kind="companies" singular="Company" nameLabel="Company Name" showCode={false} showActive={false} />`.
- I'll give you the matching SQL so the table can be created on the Production server before deploying.
