# Lighten Main Content Text

## What we're doing
Soften the color of body text, headings, labels, and table content in the main content area while keeping the existing light background, so the UI matches the softer text tone in the reference image and maintains readable contrast.

## Current state
`src/styles.css` uses a dark navy foreground for main content text:
- `--foreground: oklch(0.28 0.06 245)`
- `--card-foreground: oklch(0.28 0.06 245)`
- `--popover-foreground: oklch(0.28 0.06 245)`
- `--muted-foreground: oklch(0.48 0.035 245)`

Sidebar text is already very light (`--sidebar-foreground`) and is not in scope.

## Proposed change
1. In `src/styles.css`, update the main content foreground tokens to a lighter, less saturated dark gray-blue that still passes contrast against the light background (`--background`, `--card`, `--popover`).
2. Adjust `--muted-foreground` in proportion so secondary/placeholder text stays visually subordinate.
3. Leave the corporate blue accent palette, backgrounds, and sidebar styling unchanged.

## Verification
- Review the E-NFA Report screen and at least one other main-content screen in the preview.
- Confirm text appears softer while remaining legible.
