# Apply the Anumati design brief (Sign-in page + Dashboard look)

Only colors, fonts and branding change. Sign-in logic, dashboard counts, SAP calls, links and permissions stay exactly as they are. Today's dashboard content (five status cards, doughnut chart, Quick actions, Pending your approval) is kept — the brief says "all elements and layout unchanged".

## Brand assets
- Use the provided Anumati wordmark and lockup images (light and dark versions) from the brief.

## Colors (exact codes from the brief)
- Ramky Blue #0077BD — buttons, links, active menu item, avatar, Pending card
- Deep Blue #003F69 — sign-in left panel and sidebar
- Orange #E77817 (on dark) / #DE7012 (on white), Green #21B354, Light Blue #4DC8F4 — wordmark and accent squares
- Sky Blue #91D8F6 — sidebar section labels, feature icons
- Charcoal #373435, Burnt Orange #B85A0A, Deep Green #12803A, Red #B42318 — status cards
- Ink #1F2A33, Grey text #566069, Border #E1E6EB, Field border #C9D1D9, Blue tint #E3F1FA, Page grey #F3F6F9 (sign-in right #F8FAFC), Light text #D6EEFA / footer #B9DDF0

## Fonts
- Marcellus 400 — headings (sign-in headline 40px, "Welcome" 24px, page title 22px, card titles 20px) and "ANUMATI"
- IBM Plex Sans 400/500/600 — body, labels, buttons, menu, card numbers (32px, 600)
- Noto Sans Telugu / Noto Sans Devanagari Bold — wordmark

## Sign-in page
- Left: Deep Blue panel with Ramky + Anumati lockup, three accent squares, large wordmark, headline "Paperless approvals, with a complete trail.", paragraph, three feature lines with Sky Blue icons, footer "© 2026 Sharvi Infotech" and "Secure SSO".
- Right: wordmark above the card; card title "Welcome"; form fields and button unchanged in behavior, restyled to the brief.

## Dashboard and portal frame
- Sidebar in Deep Blue with Ramky logo tile + Anumati wordmark; Sky Blue section labels; active item Ramky Blue.
- Page background Page grey; white cards with #E1E6EB borders; headings in Marcellus.
- Status cards become solid colors: Pending #0077BD, Clarification #373435, Back to Initiator #B85A0A, Approved #12803A, Rejected #B42318 (doughnut slices use the same colors).
- Quick action icon tiles use Blue tint; dashed empty-state boxes use Field border.

## Question
The mockup still shows the old cards ("My submitted NFAs", "Under review") and the old status table. The plan keeps your current cards and chart and only recolors them — tell me if you want the mockup's original cards back instead.

## Technical details
- Upload the brief PNGs with lovable-assets and import their pointers.
- Update tokens in `src/styles.css` (brand, status, neutrals, font families, kpi utilities) and font links in `src/routes/__root.tsx`.
- Restyle `src/routes/auth.tsx`, the sidebar/header in the app shell, and card colors in `src/routes/index.tsx`. Markup/classes only; no logic edits. Update the sign-in page title to "Anumati – Sign in".
