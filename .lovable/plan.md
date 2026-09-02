# Remove Header Icons from Global Header

## Goal
Remove the three icon buttons shown in the uploaded image from the global header: the **Bell** (notifications), **History/Audit** drawer trigger, and **Info/Legend** popover trigger. Leave every other element, functionality, API integration, and layout unchanged.

## Current State
- The global header is rendered in `src/components/AppShell.tsx`.
- The right-hand header group currently contains:
  - Search input (`Search NFA #, subject…`)
  - Bell notifications button (`Bell` icon)
  - `AuditHistoryDrawer` (clock/history icon)
  - `StatusLegend compact` (info icon)
  - User profile block
  - Sign-out button
- The uploaded image shows the search input plus the Bell, History, and Info icons that the user wants removed.

## Proposed Changes

### `src/components/AppShell.tsx`
1. **Remove the Bell notifications button**
   - Delete the `<Button variant="ghost" size="icon">` wrapping the `<Bell>` icon.
2. **Remove the Audit History drawer trigger**
   - Delete the `<AuditHistoryDrawer />` component call in the header.
3. **Remove the compact Status Legend button**
   - Delete the `<StatusLegend compact />` component call in the header.
4. **Preserve the remaining header layout**
   - Keep the search input exactly as is.
   - Keep the user profile block and Sign-out button exactly as is.
   - Do not change any imports unless they become unused; if `Bell`, `AuditHistoryDrawer`, or `StatusLegend` imports become unused, remove them to avoid lint warnings.

## Guardrails
- Do not modify any functionality, API integration, routing, auth, or page content.
- Do not change spacing, colors, or responsive behavior of the remaining header elements.
- Do not remove the `AuditHistoryDrawer` component file itself, only its usage in the header.
- Do not remove the `StatusLegend` component file itself, only its usage in the header.
- Verify the build/typecheck passes after removal.

## Acceptance Criteria
- [ ] Bell icon no longer appears in the global header.
- [ ] History/Audit icon no longer appears in the global header.
- [ ] Info/Legend icon no longer appears in the global header.
- [ ] Search input, user profile block, and Sign-out button remain visible and functional.
- [ ] No build, typecheck, or runtime errors are introduced.
