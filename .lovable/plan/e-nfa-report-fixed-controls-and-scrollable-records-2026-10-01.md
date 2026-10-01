# E-NFA Report: fixed controls and scrollable records

## Goal
Match the supplied report-table behavior while preserving the portal’s current styling and workflows:
- Keep the report title, filters, result count, action buttons, search box, and desktop column headings visible.
- Scroll only the returned record rows vertically.
- Keep horizontal scrolling available for the existing wide table.

## Changes
In `src/routes/_authed.report.tsx`:

1. Add a search field beside the result count and existing record-action buttons, following the first two reference screenshots without restyling the table.
2. Filter the already-loaded SAP records in the browser using a case-insensitive search across every displayed record value, including eNFA number, plant, type, function, subject, initiator, approval fields, and status.
3. Show the filtered result count and clear any selected row that is no longer visible after searching, so Preview, Edit, attachments, and upload actions cannot target a hidden record.
4. Keep the page heading, filter controls, Execute/Reset controls, search, result count, and record-action buttons outside the scrolling rows area.
5. Give the desktop results table its own constrained vertical scroll area and make its existing column-heading row sticky. Preserve the existing horizontal scroll, sticky eNFA-number column, row selection, statuses, column order, and all actions.
6. Apply the same search results to the existing mobile record cards while retaining their current incremental loading behavior.
7. Reset the search when the report screen is re-entered; do not change SAP requests, exports, dialogs, uploads, or other screens.

## Verification
- Execute a report with enough rows to overflow the available height.
- Confirm the page heading, filters, Execute/Reset, search, result actions, and table column headings remain visible while only rows scroll vertically.
- Confirm horizontal table scrolling still works and the heading row remains fixed.
- Search using values from different columns and confirm matching rows/counts update without another SAP call.
- Confirm selecting a visible row still supports Upload File, Attached Docs, Preview, and Edit.
- Check desktop and mobile layouts, then confirm the current build has no errors.
