# Fix Sidebar Toggle Alignment Beside NFA Portal

## Goal
Clean up the alignment and positioning of the sidebar collapse/expand toggle so it sits neatly beside the NFA Portal branding in both expanded and collapsed states, without changing any existing sidebar functionality.

## Current State
- `src/components/AppShell.tsx` renders two separate toggle buttons in the sidebar branding row:
  - One inside the text block that is hidden when collapsed.
  - Another conditional button that appears only when collapsed.
- This dual-button approach causes visual misalignment and inconsistent spacing.
- The reference screenshot shows the sidebar in the collapsed state with the logo visible and the toggle icon floating awkwardly.

## Proposed Changes

### 1. Use a single, always-visible toggle button
- Replace the two toggle buttons with one button that is always rendered in the branding row.
- Position the toggle to the right of the text block when expanded, and to the right of the logo when collapsed.

### 2. Restructure the branding row layout
- Keep the logo as a fixed left element.
- Wrap the text stack and toggle in a flex container that collapses gracefully.
- When collapsed, hide only the text stack (width/opacity transition) while the toggle remains visible and aligned with the logo.
- Maintain `justify-center` in the collapsed state so the logo and toggle stay centered within the narrow sidebar.

### 3. Preserve existing transitions and behavior
- Keep the `transition-all duration-300` animations for width, opacity, and spacing.
- Keep the same `PanelLeft` / `PanelLeftClose` icons and `aria-label` / `title` behavior.
- Do not change navigation items, mobile drawer behavior, header layout, or page content.

## Files to Modify
- `src/components/AppShell.tsx`

## Acceptance Criteria
- [ ] Only one toggle button exists in the sidebar branding row.
- [ ] Expanded state: logo, "NFA Portal" text, and toggle are aligned in a single clean row.
- [ ] Collapsed state: logo and toggle remain centered and aligned, with text hidden.
- [ ] Smooth collapse/expand animation is preserved.
- [ ] No changes to navigation, mobile drawer, header, or page functionality.
