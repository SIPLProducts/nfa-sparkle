# Fix Sidebar Toggle Alignment

The toggle currently shares the brand row with the logo and the "NFA Portal" text. When the sidebar collapses, the logo and the toggle both try to fit into the narrow rail, so the button sits off-centre and the row height jumps.

## What changes

- Give the sidebar brand row a fixed height so it never shifts when collapsing/expanding.
- Expanded: logo on the left, "NFA Portal / SAP Integrated" next to it, toggle pinned to the right edge, vertically centred with the logo.
- Collapsed: show only the toggle, perfectly centred in the 64px rail (logo hidden), matching the reference screenshot.
- Add a divider under the brand row so the toggle area reads as its own header block.

## Technical notes

- Single file: `src/components/AppShell.tsx`.
- Brand row becomes `h-16` with `items-center`, `justify-between` when expanded and `justify-center` when collapsed; logo block gets hidden via conditional render when collapsed.
- Toggle keeps the existing `PanelLeft` / `PanelLeftClose` icons, aria-label, and `setSidebarCollapsed` handler — no behaviour change.
- Nav, footer, mobile drawer, and scrolling behaviour untouched.
