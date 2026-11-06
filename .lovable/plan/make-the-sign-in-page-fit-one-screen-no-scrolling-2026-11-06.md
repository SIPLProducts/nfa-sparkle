# Make the Sign-in page fit one screen (no scrolling)

## What changes
- The page is locked to the exact screen height, so the left panel and the sign-in card both fit without a scrollbar at 100% zoom.
- On shorter screens (like laptops), the large Anumati name, the headline and the spacing shrink automatically so the feature lines and footer stay visible. On tall screens they keep the current size.
- Tighter gap above the three small colored squares so they no longer touch the Ramky logo.
- Right side: the Anumati name and card spacing shrink slightly on short screens so the whole card and "Need help?" line fit.
- On phones and very small windows the page can still scroll if needed, so nothing gets cut off.

## What stays the same
- Sign-in, User ID/Email lookup, password, Forgot password link, colors, fonts and text.

## Technical details
- `src/routes/auth.tsx` only: root `h-dvh lg:overflow-hidden`; both panels `h-full` with `lg:p-[clamp(1.5rem,4vh,3rem)]`; left middle block uses `gap-[clamp(...vh...)]`; the wordmark gets a size based on screen height (`min(88, 9vh)`); headline `text-[clamp(1.75rem,4.2vh,2.5rem)]`; right panel `overflow-y-auto` as a fallback.
