# Add Sidebar Toggle Beside NFA Portal Branding

## Goal
Move the sidebar collapse/expand toggle from the top header into the sidebar itself, positioned beside the "NFA Portal" branding block, without changing navigation behavior, layout stability, or any existing functionality.

## Current State
- `src/components/AppShell.tsx` already supports a `sidebarCollapsed` state and animates the sidebar between `md:w-64` (expanded) and `md:w-16` (collapsed).
- The toggle button currently lives in the top header (left of the page title) and uses `PanelLeft` / `PanelLeftClose` icons.
- The sidebar branding area contains the Ramky logo and the "NFA Portal / SAP Integrated" text stack.

## Proposed Changes

### 1. Relocate the toggle into the sidebar header
- Render the toggle button inside the sidebar's branding row, to the right of the "NFA Portal" text block.
- Keep the same icons (`PanelLeftClose` when expanded, `PanelLeft` when collapsed) and the same `aria-label` / `title` behavior.
- Remove the existing toggle button from the top header so there is only one control.

### 2. Preserve collapse behavior
- Re-use the existing `sidebarCollapsed` state and `setSidebarCollapsed` setter.
- Keep the existing `transition-all duration-300 ease-in-out` width animation.
- Keep the existing text/icon fade transitions for nav labels, section headers, footer, and branding subtitle.

### 3. Maintain layout and accessibility
- Ensure the branding row remains a single flex line that does not wrap when collapsed.
- When collapsed, hide the text stack and show only the logo, as today; the toggle button should remain visible and centered alongside the logo.
- Keep mobile behavior unchanged: the mobile drawer continues to show the full expanded sidebar and its own branding block without the desktop toggle.

### 4. No functional side effects
- Do not alter navigation items, routing, auth checks, header actions, search, notifications, sign-out, or page content.
- Do not change the mobile hamburger menu or `Sheet` behavior.

## Files to Modify
- `src/components/AppShell.tsx`

## Acceptance Criteria
- [ ] A collapse/expand toggle appears beside the "NFA Portal" branding inside the desktop sidebar.
- [ ] Clicking it smoothly collapses/expands the sidebar.
- [ ] The header no longer contains a duplicate toggle.
- [ ] All existing sidebar states (expanded, collapsed, mobile drawer) continue to work.
- [ ] No navigation, layout, or styling regressions.
