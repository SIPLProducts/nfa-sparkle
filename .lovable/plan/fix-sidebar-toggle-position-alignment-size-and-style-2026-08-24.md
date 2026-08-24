# Fix Sidebar Toggle Position, Alignment, Size and Style

Reference: the toggle sits in a dedicated brand row at the top of the dark sidebar — a square, subtly outlined icon button that stays in the same spot whether the sidebar is expanded or collapsed. Today the toggle shares the row with the logo and text, so it drifts and the row height changes on collapse.

## What changes

- The sidebar brand row gets a fixed height (64px) so nothing shifts when collapsing/expanding.
- Expanded: Ramky logo + "NFA Portal / SAP Integrated" on the left, toggle pinned at the right edge, vertically centred with the logo.
- Collapsed: only the toggle remains, perfectly centred in the narrow rail (logo hidden), exactly like the reference.
- Toggle styling matched to the reference: 36x36 square, rounded corners, soft white/10 border, muted white icon that brightens on hover.
- A thin divider under the brand row so the toggle reads as its own header block.

## Technical notes

- Single file: `src/components/AppShell.tsx`.
- Brand row: `h-16` + `items-center`, `justify-between` expanded / `justify-center` collapsed; logo block conditionally hidden when collapsed.
- Toggle keeps the existing `PanelLeft` / `PanelLeftClose` icons, aria-label, title, and `setSidebarCollapsed` handler — behaviour unchanged.
- Navigation list, footer, mobile drawer, header, and scroll behaviour untouched.
