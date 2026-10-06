# Add scrollbar to Edit user dialog

## Problem
The Edit user dialog (User Management → Edit) renders all fields without a height limit, so on shorter viewports it overflows past the screen: the Role field and Save/Cancel buttons get cut off, as in the screenshot from enfa.siplproducts.com/admin/users.

## Change
Single file: `src/routes/_authed.admin.users.tsx`

- Wrap the Edit dialog's field body (the `space-y-4` div between the header and footer, containing First name, Last name, User ID, Email ID, Company Name, Department, Contact, Status, Role) in the same scroll container the Create dialog already uses:
  `className="space-y-4 max-h-[60vh] overflow-y-auto pr-1"`
- No other dialogs, files, layout, or logic change.

## Result
On short screens the Edit dialog keeps its header and Save/Cancel buttons visible while the fields scroll inside the dialog, matching the Create dialog's existing behavior.
