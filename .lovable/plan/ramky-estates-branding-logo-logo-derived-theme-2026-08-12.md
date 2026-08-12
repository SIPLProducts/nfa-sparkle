# Ramky Estates branding: logo + logo-derived theme

## What changes

**1. Logo on the login page**
Replace the generic building icon + "NFA Portal" mark on the sign-in screen with the Ramky Estates logo:
- Large logo on the left brand panel (on the dark background, so it sits inside a light rounded plate for contrast).
- Same logo on the small mobile header shown above the sign-in card.
- Keeps the "Note For Approval - SAP Integrated" descriptor line.

**2. Logo in the app after login**
- Sidebar header: Ramky Estates logo instead of the building-in-a-box icon, with "NFA Portal / SAP Integrated" beside it.
- Mobile slide-out nav header: same treatment.
- Browser favicon set from the logo.

**3. Theme colours taken from the logo**
The logo uses Ramky blue (deep corporate blue wordmark), orange, and green. New palette:
- Primary / sidebar: Ramky deep blue (replaces the current navy).
- Accent / highlights, active nav dot, focus rings: Ramky orange.
- Success / approved states: Ramky green.
- Neutral surfaces stay light grey/white so the screens stay enterprise-clean.

Applied globally through the design tokens, so buttons, sidebar, KPI tiles, badges, and the login screen all pick it up automatically. The login page's hardcoded navy hexes get swapped to the shared tokens so it matches the rest of the app.

## Technical notes

- Add the uploaded logo as a Lovable asset pointer (`src/assets/ramky-logo.png.asset.json`) and import it where needed; copy a square padded version to `public/favicon.png` and update the icon link in `src/routes/__root.tsx`.
- Edit `src/styles.css`: retune `--brand-navy`, `--brand-navy-2`, `--brand-blue`, `--accent`, `--ring`, `--sidebar*`, and chart tokens to the logo's blue/orange/green in oklch.
- Edit `src/routes/auth.tsx` (logo, remove `#0b2545`/`#13315c` literals in favour of tokens) and `src/components/AppShell.tsx` (sidebar + mobile sheet logo).
- No backend or logic changes.
