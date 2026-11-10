# Sharper Ramky logo and roomier white box on Login

## What changes
- **Sharp logo everywhere:** the current Ramky logo is a small, low-resolution picture, so it looks soft when shown. Your design brief contains the same Ramky Estates logo at about 3 times the resolution. That clean copy will be cut out and placed on a white background, then used in the sidebar, the mobile menu and the login page. The displayed size stays exactly the same; only the clarity improves.
- **Login page:** the logo sits in a white rounded box with slightly more white space around it, so it stands out better on the dark blue panel. The box height stays close to today's so the layout does not shift.

## Not changed
- Sidebar box size and spacing (from the last change), the Anumati name, the "Note For Approval" text, the login form and every other feature.

## Technical details
- Create `public/ramky-logo-hd.png`: crop the Ramky logo from `Anumati_Lockup_Light_BG.png` (about x 20–830, y 20–720) and flatten it onto white. Keep the existing logo files.
- `src/components/AppShell.tsx` (2 places) and `src/routes/auth.tsx`: point to `/ramky-logo-hd.png`.
- `src/routes/auth.tsx`: wrap the logo in `rounded-md bg-white p-2` with the same overall height (`h-[clamp(2.5rem,7vh,3.5rem)]` on the box, image `h-full w-auto`).
