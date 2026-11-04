# Match the Actions header to the other headers

Problem: In the Users table, the "Actions" heading shows a lighter/white background while every other heading has the shaded grey header background.

## Fix (display only)
- Give the Actions heading exactly the same background, text color, size, letter spacing and padding as the other headings in the Users table.
- Make the shaded header background cover the whole header row, so no heading cell can look different when the table is scrolled sideways.
- Check the Roles table and the Departments / Designations / Companies tables for the same mismatch and align them the same way.

## Not changed
Buttons, dialogs, data and permissions stay exactly as they are.

## Technical details
- `src/routes/_authed.admin.users.tsx`: the leftover pinned styling from the earlier change is already removed in the current code; also apply the header background on the header row (`tr`) so all `th` cells share it.
- Verify with a Playwright screenshot of the header row after the change; the live site will need publishing to show it.
