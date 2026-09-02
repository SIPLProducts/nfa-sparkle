# Remove Global Search from Header

## Goal
Remove the global search input ("Search NFA #, subject…") from the global header, leaving all other header elements, functionality, API integrations, and layout unchanged.

## Current State
- The global header is rendered in `src/components/AppShell.tsx`.
- The right-hand header group currently contains:
  - Search input (`Search NFA #, subject…`)
  - User profile block
  - Sign-out button
- The previous plan removed the Bell, History, and Info icons; only the search input remains in the uploaded image.
- The search input is a visual/static element with no attached search handler or API call.

## Proposed Changes

### `src/components/AppShell.tsx`
1. **Remove the global search input**
   - Delete the `<div className="relative hidden lg:block">` wrapper containing the `<Search>` icon and the `<input type="search" …>`.
2. **Clean up unused imports**
   - Remove the `Search` import from `lucide-react` if it is no longer used elsewhere in the file.
3. **Preserve remaining header layout**
   - Keep the user profile block and Sign-out button exactly as is.
   - Do not change spacing, colors, responsive behavior, or the mobile header title.

## Guardrails
- Do not modify any functionality, API integration, routing, auth, or page content.
- Do not change spacing, colors, or responsive behavior of the remaining header elements.
- Do not remove any component files; only remove the usage in the header.
- Verify the build/typecheck passes after removal.

## Acceptance Criteria
- [ ] Global search input no longer appears in the global header.
- [ ] User profile block and Sign-out button remain visible and functional.
- [ ] No build, typecheck, or runtime errors are introduced.
