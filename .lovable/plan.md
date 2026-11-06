# Redesign the Sign-in page to match the "Anumati" reference

Only the look of the sign-in page changes. Sign-in logic, User ID/Email lookup, role checks and redirects stay exactly as they are.

## Left panel (large screens)
- Solid deep navy background (#003F6E, no gradient or pattern).
- Top: Ramky logo shown directly (no white box), thin divider, then "Note For Approval" / "SAP Integrated".
- Three small squares (orange #E8792B, light blue #4FB3E8, green #3DAA5C).
- Large "అను" (white) + "मति" (orange) wordmark, with spaced "ANUMATI" below.
- Headline "Paperless approvals, with a complete trail." in a light serif-style weight.
- Description: "Raise, route and approve Notes For Approval across companies, projects and functions, linked to your SAP master data with every step recorded."
- Same three feature rows (approval chains, attachments/audit log, role-based access) with outline icons.
- Footer: "© 2026 Sharvi Infotech. All rights reserved." and "Secure SSO".

## Right panel
- Very light grey background (#F7F8FA).
- Centered "అను" (blue #0072BC) + "मति" (orange) wordmark with "ANUMATI" below (also used as the logo on small screens).
- White card: "Welcome", subtitle, User ID / Email, Password with "Forgot password?" link, full-width blue (#0072BC) "Sign in" button, "Protected by role-based access…" note.
- "Need help? Contact IT Support" under the card.

## Fonts
- Wordmark: Noto Sans Telugu (అను) and Noto Sans Devanagari (मति), bold.
- Headings and body: IBM Plex Sans (matches the clean look in the image).
- Loaded from Google Fonts on the sign-in page only, so the rest of the portal is untouched.

## Technical details
- Edit only `src/routes/auth.tsx` markup/classes; add color tokens (`--anumati-navy`, `--anumati-blue`, `--anumati-orange`, etc.) in `src/styles.css`; add font links in the auth route `head()` and update its title to "Anumati – Sign in".
- Wordmark rendered as text (no image needed).

## Question
The image doesn't list exact hex codes, so the colors above are sampled from it. If you have the official codes or font names, send them and they'll be used instead.
