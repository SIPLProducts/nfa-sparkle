# Remove Deactivate from User Management

## Scope
- Remove the per-user **Deactivate / Activate** button from the User Management table.
- Keep the **Status** column visible so each account’s current state remains clear.
- Preserve **Edit**, **Password**, and **Delete** actions exactly as they are.
- Keep the existing status selection in the Create User form unchanged.

## Technical details
- Remove only the row-level activation control and its now-unused page-side mutation/imports.
- Leave account data, server authorization, user creation, deletion protections, search, table layout, and all other screens unchanged.
- Verify the table at the current viewport and confirm the application builds cleanly.
