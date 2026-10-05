# Allow Custom Roles With System Role Names

## Confirmed Cause

The four system roles use reserved internal keys (`admin`, `approver`, `initiator`, and `viewer`). Custom-role creation currently derives the same key from the entered name, so creating a custom role named “Admin”, “Approver”, “Initiator”, or “Viewer” is rejected before insertion. No custom roles currently exist in the role definitions table.

## Implementation

- Generate a separate internal key for every new custom role using a `custom_` prefix, such as `custom_admin`, while keeping the visible name as “Admin”.
- Continue preventing duplicate custom role names, including names that normalize to the same custom key.
- Keep system-role records and keys unchanged so authentication, permissions, existing assignments, and workflows continue working.
- Keep custom roles independent from same-named system roles; their users and screen permissions will be stored against the custom key.
- In Create User and Edit User role selectors, group and label choices as **System Roles** and **Custom Roles** so identical visible names are unambiguous.
- Preserve the existing user edit flow so an administrator can change another user from a system role to a custom role; existing assignment code will remove the previous assignment and save the selected one in the correct role store.
- Preserve the safeguard that prevents the signed-in administrator from accidentally removing their own system Admin access.
- Refresh both role and user lists after role creation or user assignment so saved changes appear immediately.

## Verification

- Create custom roles named Admin, Approver, Initiator, and Viewer and confirm each saves under Custom Roles without altering system roles.
- Confirm a second custom role with the same normalized name is rejected as a duplicate.
- Edit a user currently holding a system role, select the same-named custom role, save, and confirm the custom assignment persists.
- Confirm system and custom choices are clearly separated in both user forms and Screen Permissions.
- Confirm existing users, assignments, system permissions, and other User Management tabs remain unchanged, then check the app build.
