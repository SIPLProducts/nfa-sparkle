# Keep the previous Edit user popup behavior

## Confirmed current behavior
- Edit user currently opens in a popup, not inline within the Users page.
- It loads the selected user's existing details, including Email ID, and has Save changes and Cancel buttons.
- Its fields scroll inside the popup.

## Plan
1. Keep Edit user as the existing popup; do not convert it into an inline page form.
2. Check opening Edit from a user row, populated fields, Cancel, and reopening the popup against the previous behavior.
3. If that behavior is broken, make only the presentation change needed to restore it. If it already works, leave the application unchanged.
4. Preserve Email ID, the scrollbar, field order, validation, and the existing save process. No changes to user data, roles, other screens, or SAP requests.

## Verification
- Edit opens the popup with the selected user's details.
- Cancel closes it without saving; reopening loads the selected user's details again.
- Save changes retains the existing action and error handling.

## Technical scope
Only the Edit user presentation in `src/routes/_authed.admin.users.tsx`, if a correction is required; no server or database changes.