# Tighter Ramky logo in the sidebar

## What changes
- The Ramky logo picture has a wide white border built into it, so the logo looks small inside the white box in the sidebar. A trimmed copy of the same logo, with that border cut off, will be made.
- The white box in the sidebar (desktop and mobile menu) gets less inner spacing, so the logo fills it and much less white shows. The box stays the same size and shape.
- The same trimmed logo is used everywhere it appears (sidebar, mobile menu, login page), so it looks the same on every screen.

## Not changed
- Logo artwork and colours, the Anumati wordmark, navigation, the collapse button, login and all other features.

## Technical details
- Make `public/ramky-logo-trim.png` by cropping `public/ramky-logo.png` to its non-white content area (about 53,8 to 506,402) plus a small margin. Keep the original file.
- `src/components/AppShell.tsx` (two places): change `p-1.5` to `p-0.5` and use the trimmed logo file.
- `src/routes/auth.tsx`: use the trimmed logo file, same size.
