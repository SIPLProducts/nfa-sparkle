# Fix overlapping Actions column in Users table

Problem: After the last change, the pinned Actions column floats over the Status column when the table is scrolled sideways. It hides the "Active" badge and the Actions heading, and only part of the buttons shows.

## Fix (display only)
- Remove the pinning so Actions sits as a normal last column after Created and never covers other columns.
- Give the column a fixed width that fits all three icon buttons (Edit, Reset password, Delete) on one line, evenly spaced and centered, with a centered "Actions" heading.
- Keep sideways scrolling for narrow screens so every column, including Actions, can be reached.

## Not changed
Button actions, delete confirmation, dialogs, permissions and data stay exactly as they are.

## Technical details
- `src/routes/_authed.admin.users.tsx`: drop `sticky right-0 bg-muted/bg-card` from the Actions th/td, set actions `<col>` to `w-[160px]`, and adjust the table `min-w` to match.
- Verify with Playwright at 1280px and a narrow width that all three buttons and the Status badge are fully visible.
