# Fix selected-user deletion

## Goal
Make **Delete** successfully remove only the selected user from active User Management and prevent further login, while preserving all existing NFA, approval, attachment, audit, and SAP records.

## Changes
- Keep the current administrator authorization, self-deletion protection, confirmation popup, and selected-row behavior.
- Replace the linked-record dead end with a safe administrative deletion path:
  - ban the selected account from signing in;
  - mark its profile as deleted/inactive;
  - remove its active role assignments;
  - exclude deleted profiles from the User Management list.
- Continue using permanent account deletion only when the selected user has no linked business records.
- Refresh the user list after completion and show the existing Swal success or error message.
- Ensure no other user is updated and no linked NFA, approval, attachment, audit, approval-chain, or SAP record is deleted.

## Verification
- Delete an unlinked test user and confirm only that account is permanently removed.
- Delete a linked test user and confirm it disappears from User Management, cannot sign in, and all linked business history remains visible.
- Confirm Cancel performs no change, self-deletion remains blocked, and Edit/Password/Create User continue to work.
- Run focused checks and verify the app builds without errors.

## Technical details
- Implement the fallback inside the existing authenticated, admin-only server function; no privileged operation will move into the browser.
- Use the existing profile status and account-ban mechanisms rather than changing destructive foreign-key cascades.
- Keep the current UI layout and confirmation wording unchanged.
