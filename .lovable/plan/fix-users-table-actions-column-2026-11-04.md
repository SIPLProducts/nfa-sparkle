# Fix Users table Actions column

Problem: In User Management > Users, the Edit / Password / Delete buttons wrap onto three lines, the "Actions" header is clipped at the right edge, and rows become very tall.

## Changes (display only)
- Replace the three labeled buttons with compact, equal-size icon buttons (Edit pencil, Password key, Delete trash) in one row, evenly spaced and centered, with tooltips/aria-labels showing "Edit", "Reset password", "Delete".
- Keep the Delete button red; Edit and Password outlined.
- Narrow the Actions column to fit the three icons and stop wrapping; center the "Actions" header so it never clips.
- Keep the Actions column pinned to the right while the table scrolls sideways on small screens, with a matching background so it stays readable.
- Apply the same icon-button styling to the Roles table Actions column for consistency.

## Not changed
Click handlers, delete confirmation, password dialog, edit dialog, permissions and data loading stay exactly as they are.

## Technical details
- File: `src/routes/_authed.admin.users.tsx` only (colgroup width for actions, th/td classes, button `size="icon"` with `h-8 w-8`, `flex flex-nowrap justify-center gap-2`, `sticky right-0 bg-card` on actions cells).
