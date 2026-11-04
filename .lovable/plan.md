# Make Company mandatory in Create User

Your screenshot shows the Create User dialog in User Management, so the change goes there. Create NFA already labels the field "Company" and already requires it.

## Changes (Create User dialog only)
- Rename the "Company Name" label to "Company" and add the red required asterisk.
- If no company is selected when you click Create user, show "Company is required" under the dropdown plus the same toast used for Department, and stop the save.
- The error clears as soon as a company is picked or the dialog is reopened.

## Not changed
- Edit User, the Companies tab, other fields and validations, how the company is saved, and all SAP calls and payloads.

## Technical details
- In `src/routes/_authed.admin.users.tsx`, the shared company picker (line ~496) gets a `required` prop and an optional error prop. Only Create User turns them on, so Edit User stays as it is.
- A `companyError` state follows the existing `deptError` pattern in the create submit handler (line ~623).
