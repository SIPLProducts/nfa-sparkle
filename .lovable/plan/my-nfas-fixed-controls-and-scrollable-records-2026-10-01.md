# My NFAs: fixed controls and scrollable records

## Goal
Keep the current My NFAs design and workflows while making long record lists easier to use:
- Keep the page heading, search, record count, action buttons, and desktop column headings visible.
- Scroll only the records/rows inside the results area.
- Preserve horizontal scrolling for the wide desktop table.

## Current state confirmed
- The My NFAs screen already has a search field, record selection, Refresh, Upload File, Attached Docs, Preview, and Edit actions.
- The search currently checks only eNFA number, subject, NFA type, and plant name.
- The records table does not have its own constrained vertical scrolling area, so its headings and actions move away with the page.

## Changes
1. Restructure only the My NFAs screen into a fixed upper area and a height-constrained results area.
2. Keep the existing title, subtitle, New NFA button, record count, and action buttons visually unchanged and outside the scrolling rows.
3. Keep the desktop table's existing columns, statuses, radio selection, spacing, colors, and row interactions unchanged.
4. Make the desktop column-heading row sticky while the table body scrolls vertically; retain horizontal scrolling for all existing columns.
5. Expand the existing browser-side search to cover every displayed record value, including eNFA number, status, plant, NFA type, subject, created date, and approval levels, without making another API request.
6. Clear the selected record if filtering removes it, preventing actions from targeting a hidden row.
7. Apply the same search results to the existing mobile cards and preserve their incremental loading behavior.
8. Limit any viewport-specific scrolling adjustment to `/nfa/my`, so all other screens remain unchanged.

## Verification
- Load enough My NFAs records to overflow the available height.
- Confirm the heading, search, record count, actions, and desktop column names stay visible while only rows scroll.
- Confirm horizontal table scrolling and record selection still work.
- Search values from multiple columns and verify the visible records and count update immediately.
- Confirm Upload File, Attached Docs, Preview, Edit, Refresh, and New NFA retain their existing behavior.
- Check desktop and mobile layouts and confirm the app has no errors.
