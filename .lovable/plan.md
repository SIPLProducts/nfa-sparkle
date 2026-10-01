# Approvals: fixed actions, headings, and scrollable records

## Goal
Keep the current Approvals design and workflows while making long worklists easier to review:
- Keep the page heading, search, item count, action buttons, and desktop column headings visible.
- Scroll only the approval records inside the results area.
- Preserve horizontal scrolling for the existing wide table.

## Current state confirmed
- The Approvals screen already has a search field and the existing Refresh, Preview, Print Form, Attached Docs, Approve, Reject/Cancel, Back To Initiator, and Clarification actions.
- Search currently checks eNFA number, subject, NFA type, and plant name.
- The desktop table has no constrained vertical records area or sticky heading row, so the records currently move with the surrounding page.
- Selection is stored by filtered-row position, which can point to a different record when search results change.

## Changes
1. Constrain only the Approvals screen to the available page height, leaving every other screen unchanged.
2. Keep the existing page heading and search field fixed above the results.
3. Keep the item count and all current action buttons fixed above the scrolling records, preserving their order, styling, enabled states, dialogs, and SAP workflows.
4. Give the desktop table a dedicated vertical and horizontal scroll area, with the existing column-heading row sticky at the top.
5. Keep the existing columns, conditional Status/Level columns, row styling, and radio selection unchanged.
6. Track the selected record itself rather than its filtered position, and clear it when search removes it, preventing actions from targeting a hidden or different record.
7. Expand the existing browser-side search across all displayed record values without making another API request.
8. Apply the same search results and row-only scrolling to the existing mobile cards while preserving incremental loading.

## Technical details
- Update `src/routes/_authed.approvals.tsx` with the same fixed-upper-area and independently scrolling-records pattern already used by My NFAs.
- Extend the existing pathname-specific viewport handling in `src/components/AppShell.tsx` to `/approvals`; do not alter general application scrolling.
- No API payload, endpoint, database, approval action, Print Form, attachment, preview, or dialog changes.

## Verification
- Load enough approval records to overflow the available height.
- Confirm the page heading, search, count, and all action buttons remain visible while only records scroll.
- Confirm desktop column headings stay fixed and horizontal table scrolling still works.
- Search values from multiple displayed columns and verify results update immediately without another API request.
- Select a record, search it out, and confirm the selection clears; select a visible record and verify every existing action still targets it.
- Check desktop and mobile layouts, then confirm the current build has no errors.
