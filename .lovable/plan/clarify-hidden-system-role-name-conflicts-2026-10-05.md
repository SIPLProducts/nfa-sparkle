# Clarify Hidden System-Role Name Conflicts

## Confirmed cause
- System roles are hidden only from the Roles table; they remain saved because existing users, permissions, and access checks depend on them.
- Creating a role whose normalized name matches one of those protected roles currently triggers the generic duplicate-role message.

## Change
- Keep hidden system roles and all associated data unchanged.
- When a new role name matches a hidden system role, show a clear SweetAlert error explaining that the name is reserved and a different role name is required.
- Keep the current duplicate-role message when the conflict is with an existing custom role.
- Leave the Create Role dialog open with its entered values intact so the administrator can correct the name.

## Verification
- Confirm names matching Admin, Approver, Initiator, Viewer, or any system-marked role receive the reserved-name message.
- Confirm duplicate custom-role names retain the existing duplicate warning.
- Confirm valid unique custom roles still create successfully and appear in the Roles table.
- Confirm users, assignments, permissions, and all other User Management tabs remain unchanged.
