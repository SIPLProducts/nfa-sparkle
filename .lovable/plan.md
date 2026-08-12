# Login page: Ramky logo in the brand icon tile

## What changes

Keep the login page layout exactly as it is in the reference screenshot (centered card, "NFA Portal / Note For Approval · SAP Integrated" header, Welcome back card, demo account box).

Only the small square mark above the card changes:
- The logo tile becomes the same treatment used in the app sidebar — a rounded square plate with the Ramky Estates logo centered inside, sized so the logo reads clearly and is not cropped.
- Consistent padding and ring/border so the mark looks crisp on the light login background.
- The same tile is applied on both the desktop brand panel mark and the small header mark, so they match.

No text, fields, buttons, colours, or behaviour change.

## Technical notes

- Edit `src/routes/auth.tsx` only: adjust the logo tile wrapper (size, padding, rounding, ring) around the existing `<img src={ramkyLogo.url}>`, matching the sidebar treatment in `src/components/AppShell.tsx` (`grid h-11 w-11 place-items-center rounded-md ... p-1.5 ring-1`).
- Continue using the existing asset pointer `src/assets/ramky-logo.png.asset.json`; no new assets, no backend or logic changes.
