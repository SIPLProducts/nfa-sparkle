# Reports screen: keep table header fixed while records scroll

## Problem
On the E-NFA Report screen the page header, filters, and action toolbar are already pinned, but the desktop table header still scrolls away with the rows. Users need the column headings to stay visible while only the data rows scroll.

## Fix
In `src/routes/_authed.report.tsx`:

1. Keep the existing outer flex layout and the current `shrink-0` header section (PageHeader, filter card, results toolbar).
2. Keep the existing `flex-1 min-h-0 overflow-y-auto` records scroll container.
3. Make the desktop `<thead>` sticky within that scroll container by adding `sticky top-0 z-10` and a solid background that matches the existing `bg-muted/50` style.
4. Preserve the existing sticky first-data-column behavior by leaving the `sticky left-0 z-10` classes on the first row cell untouched and ensuring the header z-index is at least as high.
5. Leave the inner `overflow-x-auto` wrapper in place so wide tables can still scroll horizontally.

No API calls, state, selection logic, dialogs, CSV export, infinite scroll, or styling tokens change.

## Files
- `src/routes/_authed.report.tsx`

## Verification
Open E-NFA Report, run a report that overflows vertically, and scroll the records area. The page header, filters, result count, Upload/Attached Docs/Preview/Edit toolbar, and table column headings remain visible; only the table body records move. Horizontal scrolling and the sticky first column continue to work.
