# Inline Edit user form

## Change
- Clicking **Edit** in User Management → Users will show the form directly within the Users page instead of opening a popup.
- While editing, replace the Users search, Create user button, and table with the selected user's form. Keep the User Management heading and existing tabs.
- Show **Edit user**, the selected user's identity, and all existing fields: First name, Last name, User ID, Email ID, Company Name, Department, Contact, Status, and Role.
- Populate every field from the selected user's current record; retain the existing company and role selectors without hardcoded data.
- Use the page's normal scrolling rather than the popup's height-limited field area. Keep a constrained form width and the existing field order so alignment remains clear.

## Save and Cancel
- **Save changes** uses the existing update action and validation. After success, refresh the users and return to the list, preserving the search text.
- **Cancel** discards unsaved changes and returns to the list.
- On a save error, keep the form and entered values visible with the existing error notification.
- Preserve the existing saving indicator and prevent repeated submission while saving.

## Scope
Presentation changes only. No changes to account update logic, permissions, stored data, Create user, Password, Delete, Roles, Screen Permissions, Approval Chain, or SAP behavior.

## Technical details
- Update `src/routes/_authed.admin.users.tsx`: convert `EditUserDialog` to an inline form and conditionally render it in `UsersTab` using the existing selected-user state and save callback.
- Remove dialog-only wrappers and the popup scroll constraint from the edit form; leave other dialogs unchanged.

## Verification
- Click Edit for different users and confirm all fields, especially Email ID, contain the correct existing values.
- Confirm there is no edit popup or backdrop and fields and actions remain accessible on shorter screens.
- Verify Cancel returns to the same searched list without saving.
- Verify successful saves refresh the list; failed validation keeps entered values available.
- Check the other user actions and tabs remain unchanged and the application has no new errors.