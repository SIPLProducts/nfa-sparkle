# Add user deletion to User Management

## User-facing result

- Add a **Delete** button to each user row beside the existing Edit, Password, and Activate/Deactivate actions.
- Clicking Delete opens the existing SweetAlert confirmation with the exact message: **“Are you sure you want to delete this user?”**
- The popup provides **Cancel** and **Delete** options; cancelling makes no changes.
- After a successful deletion, refresh the Users list and show **“User deleted successfully”** in SweetAlert.

## Safety and behavior

- Only an authenticated administrator can delete an account; authorization is verified on the server.
- Prevent administrators from deleting their own account.
- As selected, block deletion when the user is linked to any NFA, approval, attachment, working document, attachment-view history, or approval-chain assignment. Show the returned explanation in SweetAlert without removing any records.
- Delete only the selected account. Its profile and role assignments are removed through the existing account relationships.

## Implementation

1. Add a protected user-deletion server function that verifies the administrator, rejects self-deletion, checks all operational references, and then deletes the selected authentication account.
2. Add the Delete action to the existing row actions using the current Button component and destructive styling.
3. Connect the action to the shared SweetAlert confirmation and message helpers, disable repeat clicks while deletion is running, and refresh the existing `managed-users` query after success.
4. Preserve the current search, create, edit, password, activation, role, permission, and approval-chain behavior without database schema changes.

## Verification

- Confirm Cancel does not call deletion.
- Confirm Delete removes only an unreferenced selected user, refreshes the list, and shows the success alert.
- Confirm users with linked business records and the currently signed-in administrator cannot be deleted.
- Confirm server errors display through SweetAlert and existing User Management actions still work.
