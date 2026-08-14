# Keep the sidebar fixed while only the content scrolls

## Problem
The whole page scrolls as one, so the navy sidebar (NFA Portal logo, Workspace / Insights / Admin links) scrolls out of view along with the form. The second reference image shows the sidebar area blank because its content has scrolled away.

## Fix
In `src/components/AppShell.tsx`:

1. Constrain the shell to the viewport: change the outer wrapper from `min-h-screen` to a fixed `h-screen` with `overflow-hidden`.
2. Make the desktop sidebar full-height and non-scrolling as a whole (`h-screen`/`shrink-0`), keeping the existing internal `overflow-y-auto` on the nav list so long menus can still scroll inside the sidebar.
3. Make the right-hand column the scroll container: the column keeps `min-h-0` and the `<main>` gets `overflow-y-auto`, so only page content scrolls.
4. Header stays at the top of the content column (it already uses `sticky top-0`, which now sticks within the scrolling main column area).

No visual styling, colours, spacing, or navigation content changes — layout/scroll behaviour only.

## Files
- `src/components/AppShell.tsx`

## Verification
Open Create NFA, scroll down the long form: the sidebar and top bar stay in place while only the form area scrolls; mobile drawer behaviour is unchanged.
