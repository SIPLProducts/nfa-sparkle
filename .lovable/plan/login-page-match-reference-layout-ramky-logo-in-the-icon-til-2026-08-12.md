# Login page: match reference layout, Ramky logo in the icon tile

## What changes

The login screen keeps exactly the layout in your screenshot:
- Dark blue brand panel on the left: mark + "NFA Portal / Note For Approval · SAP Integrated", the "Govern approvals with enterprise-grade control." headline, the paragraph, the three feature lines, and the footer row with copyright and "Secure SSO".
- Right side: white "Welcome back" card with User ID, Password + "Forgot password?", the Sign in button, the role-based-access note, the dashed "Demo account" box with credentials and "Login as Demo User", and the "Need help? Contact IT Support" line.

The single visual change is the square brand mark: the generic building icon becomes the Ramky Estates logo on a light rounded plate, on both the desktop brand panel and the compact mobile header.

No text, fields, buttons, spacing or behaviour change.

## Why the live site still looks different

The preview build already carries this treatment; enfa.siplproducts.com is serving an older build. Once confirmed in preview, the site needs to be republished for the logo to show there.

## Technical notes

- `src/routes/auth.tsx` only: verify the logo tile wrapper (desktop 16x16 plate, mobile 14x14) rendering the existing pointer `src/assets/ramky-logo.png.asset.json`, matching the sidebar plate treatment in `src/components/AppShell.tsx`.
- Confirm the rest of the page matches the reference pixel-for-structure (headline, feature list, demo box, footer links) and correct any drift.
- No new assets, no backend or logic changes. Publish afterwards.
