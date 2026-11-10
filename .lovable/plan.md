# Make dashboard zeros clearly numeric

## What changes
- The status card counts and the total in the middle of the doughnut chart switch from the heading font (Marcellus, where 0 looks like O) to the body font (IBM Plex Sans) with even-width digits, so 0 reads clearly as a number.
- Size, weight, colour and position stay the same. Card titles and headings keep the Marcellus font.

## Not changed
- Counts, data, chart, links, layout.

## Technical details
- `src/routes/index.tsx`: line 352 (KPI value) and line 576 (chart center total) change `font-display` to `font-sans tabular-nums`.
