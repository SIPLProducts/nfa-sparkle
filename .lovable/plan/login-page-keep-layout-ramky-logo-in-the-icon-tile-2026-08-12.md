# Login page: keep layout, Ramky logo in the icon tile

## What changes

The split-screen login layout stays exactly as in the reference: dark brand panel on the left ("NFA Portal / Note For Approval · SAP Integrated", headline, three feature lines, footer) and the "Welcome back" sign-in card on the right with the demo account box.

The only change is the small square mark next to "NFA Portal": the generic building icon is replaced by the Ramky Estates logo on a light rounded plate, on both the desktop brand panel and the compact mobile header.

No text, fields, buttons, colours or behaviour change.

## Why the live site still shows the old icon

The preview already renders the Ramky logo; the published site at enfa.siplproducts.com is running an older build. After the change is confirmed in preview, the site needs to be republished for the logo to appear there.

## Technical notes

- Verify/keep the logo tile in `src/routes/auth.tsx` using the existing asset pointer `src/assets/ramky-logo.png.asset.json` (desktop 16x16 plate, mobile 14x14), matching the sidebar treatment in `src/components/AppShell.tsx`.
- No new assets, no backend or logic changes.
- Publish afterwards so the live domain picks it up.
