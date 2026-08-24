# Add Sidebar Toggle (Expand/Collapse)

## Goal
Add a smooth expand/collapse toggle to the desktop sidebar in `AppShell.tsx` so users can narrow it to an icon rail and widen it back, without changing navigation items, mobile drawer behavior, layout scroll behavior, colors, or any existing functionality.

## Approach
- Keep the existing custom sidebar implementation (no switch to shadcn/ui Sidebar).
- Add local `sidebarCollapsed` state in `AppShell`.
- Add a desktop-only toggle button in the top header, near the mobile hamburger, using `PanelLeft` / `ChevronLeft` / `ChevronRight` icons.
- Animate width and opacity with Tailwind `transition-all duration-300 ease-in-out`.

## Changes

### `src/components/AppShell.tsx`

1. **State**
   - Add `const [sidebarCollapsed, setSidebarCollapsed] = useState(false);`.

2. **Sidebar (`<aside>`)**
   - Switch width class based on state:
     - Expanded: `md:w-64`
     - Collapsed: `md:w-16`
   - Add `transition-all duration-300 ease-in-out`.
   - Keep `h-screen shrink-0 flex-col overflow-hidden` unchanged.

3. **Logo / brand area**
   - Expanded: show current logo tile + "NFA Portal / SAP Integrated" text.
   - Collapsed: show only the logo tile, centered (`justify-center`), with the text hidden via `opacity-0` / `w-0` transition.

4. **Navigation list**
   - Section labels ("Workspace", "Insights", "Admin") are hidden when collapsed.
   - Nav items keep the icon; labels are hidden with `opacity-0 w-0` transition.
   - Active indicator dot is hidden when collapsed.
   - Center icons when collapsed (`justify-center`), keep hover/active colors identical.

5. **Footer version text**
   - Hidden when collapsed.

6. **Toggle button**
   - Place a `Button variant="ghost" size="icon"` in the header left group, visible only on desktop (`hidden md:inline-flex`).
   - Use `PanelLeft` (collapsed) / `PanelLeftOpen` (expanded) or `ChevronLeft`/`ChevronRight` icons.
   - Add `aria-label` and `title` tooltip text.

7. **Main content**
   - No explicit width changes needed; the sibling flex container (`flex-1`) automatically fills the remaining space as the sidebar width transitions.

## Guardrails
- Mobile Sheet drawer remains unchanged and is still triggered by the existing `md:hidden` hamburger button.
- No navigation URLs, permission gating (`canAccess`), icons, or labels are modified.
- No color, spacing, font, or shadow tokens are changed beyond what is required for the collapsed state.
- Scroll behavior from the previous sidebar fix is preserved: outer shell stays `h-screen overflow-hidden`, sidebar nav keeps internal scrolling, and main content scrolls independently.

## Verification
- Toggle the sidebar on a desktop-width preview: sidebar collapses to a narrow icon rail and expands smoothly.
- Confirm all nav items still route correctly and active state still highlights.
- Confirm mobile hamburger still opens the full drawer and is unaffected.
- Confirm main content does not jump or overlap during/after the transition.
