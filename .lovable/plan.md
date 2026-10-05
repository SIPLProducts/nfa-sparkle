# Replace System Roles with Custom Roles

## Outcome

User Management will have one Roles view containing only Custom Roles. The System Roles sub-tab and all System Role labels will be removed.

The existing Admin, Approver, Initiator, and Viewer roles will continue under their matching Custom Role records with the same users and screen permissions.

## Safe data conversion

- Move every current Admin, Approver, Initiator, and Viewer user assignment to `custom_admin`, `custom_approver`, `custom_initiator`, and `custom_viewer` respectively.
- Copy each role's current screen permissions to its matching Custom Role.
- Change new-user default assignment from the old Initiator role to Custom Initiator.
- Update authorization checks so Custom Admin, Custom Initiator, Custom Approver, and Custom Viewer retain the same access and workflow behavior.
- Remove the four System Role definitions, their old permission rows, and their old user assignments only after the replacement data is in place.
- Keep the legacy database structure inert for compatibility with existing protected records; no System Role records or assignments will remain in active use.
- Make the conversion rerunnable and transactional so it cannot leave role data half-migrated.

## User Management changes

- Remove the System Roles / Custom Roles sub-tabs.
- Show one Custom Roles table with Admin, Approver, Initiator, Viewer, and any other custom roles.
- Remove System/Custom prefixes and System Role labels from user selectors and Screen Permissions.
- Keep Create, Edit, Delete, user assignment, and permission controls working for Custom Roles.
- Preserve the safety rules that prevent deleting an assigned role or removing the signed-in administrator's own Admin access.

## Verification

- Confirm every existing user retains the same effective role and visible screens after conversion.
- Confirm Admin access, SAP settings access, NFA creation, approvals, reports, and database-protected records still follow the same permissions.
- Confirm newly created users receive Custom Initiator by default.
- Confirm role creation, editing, assignment, permission saving, and deletion safeguards still work.
- Confirm only Custom Roles are visible and the application builds without errors.
