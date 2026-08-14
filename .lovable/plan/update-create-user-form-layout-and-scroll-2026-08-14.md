# Update Create User form layout and scroll

## Goal
Make the **Create User** form easier to use by:
1. Placing **Employee ID** and **Department** on separate full-width rows (instead of the current two-column grid).
2. Adding a scroll bar to the form body so all fields remain accessible as the dialog grows.

## Current state
- `src/routes/_authed.admin.users.tsx` renders the **Employee ID** and **Department** inputs inside a `grid gap-4 sm:grid-cols-2` block (lines 418-437).
- The form fields sit in a single `space-y-4` div inside `DialogContent` without a scroll container.

## Changes
1. Replace the two-column grid with two full-width `space-y-1.5` blocks: one for **Employee ID** and one for **Department**, preserving the existing labels, placeholders, and inputs.
2. Wrap the form field area (between `DialogHeader` and `DialogFooter`) in a scrollable container with `max-h-[60vh] overflow-y-auto` so the dialog can fit smaller screens while still showing all fields.
3. Keep the existing `DialogContent` width, footer, buttons, and overall styling unchanged.

## Files
- `src/routes/_authed.admin.users.tsx`

## Verification
- Open the User Management screen, click **Create user**, and confirm the dialog shows Employee ID and Department stacked vertically, and that scrolling works when the viewport is short.
