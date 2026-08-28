# Reports screen: keep header + filters fixed while scrolling records

## Problem
On the E-NFA Report screen, the PageHeader, filter card, and results toolbar all scroll away with the data table. Users lose access to filters, Execute/Reset, and the action toolbar while reviewing long reports.

## Fix
In `src/routes/_authed.report.tsx`:

1. Convert the route’s outer wrapper to a flex column constrained to the available content area (`flex flex-col h-full min-h-0`).
2. Group the PageHeader, filter card, and results toolbar into a non-shrinking header section (`shrink-0`).
3. Move the mobile card list and desktop table into a single scrollable records container (`flex-1 overflow-y-auto min-h-0`).
4. Preserve existing inner spacing, borders, selection logic, dialogs, CSV export, infinite scroll, and toolbar actions exactly as they are.

No API, state, or styling changes beyond the scroll behavior.

## Files
- `src/routes/_authed.report.tsx`

## Verification
Open E-NFA Report, execute a report that produces enough rows to overflow the viewport, and scroll down. The title/subtitle, filters, Execute/Reset buttons, and record action toolbar stay fixed; only the table/card list scrolls.
