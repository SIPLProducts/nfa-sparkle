# Approvals Inbox — visual refresh (UI only)

Only the Approvals screen content area changes. Sidebar, header, other screens, dialogs, data loading, SAP calls and button actions stay exactly as they are. Colours stay on the current brand blue (best fit with the existing sidebar/logo), refined for a cleaner look.

## What changes

1. **Page header**
   - Title, subtitle and search on one aligned row; search gets a wider rounded field with a clear focus ring.
   - Small pill showing the pending count ("2 pending") next to the title.

2. **Action toolbar (split into two clear groups)**
   - Left group "View": Refresh, Preview, Print Form, Attached Docs — neutral outline buttons, equal height.
   - Right group "Decide": Approve (green), Cancel/Reject (red), Back To Initiator, Clarification — solid, consistent sizes, one row on desktop, wrapping neatly on smaller screens.
   - Disabled buttons look clearly inactive (muted, not washed-out colours) until a record is selected.
   - "Selected: 100133" chip shown when a row is chosen; "Select a record to take action" hint otherwise.
   - Fixes the cramped "2 items" stacked text.

3. **Table**
   - Softer header band, slightly larger row height, zebra-free clean dividers, hover highlight.
   - Selected row gets a left accent bar and tinted background.
   - ENFA No shown as a bold link-style badge; Date and Plant columns aligned consistently; Subject truncates with full text on hover.
   - Nicer empty state with icon and Retry button (same behaviour).

4. **Mobile / tablet**
   - Existing card list kept, restyled to match: clearer spacing, selected-card highlight, toolbar scrolls/wraps cleanly.

## Technical details
- Edit only `src/routes/_authed.approvals.tsx` className/markup (plus small helper `Th`/`Td` styles); no handler, state, prop or API change.
- Use existing semantic tokens (primary, accent, success, destructive, muted); add tokens to `src/styles.css` only if needed (e.g. a subtle selected-row tint).
- Verify with build and a Playwright screenshot at desktop and mobile widths.
