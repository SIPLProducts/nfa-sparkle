# Retheme to the reference corporate blue

The reference image is a solid corporate blue (approx `#0166A8`). Only the visual theme changes — no layout, logic, API, or component behavior changes.

## What changes

- Primary brand color across the app becomes the reference blue instead of the current deep navy.
- Sidebar, header, buttons, links, focus rings, and active states pick up the new blue automatically because they read the shared theme tokens.
- Accent/highlight shifts from orange to a lighter tint of the same blue so the palette stays monochromatic like the reference. Success (green) and destructive (red) status colors stay as-is for readability.
- Backgrounds and surfaces get a very light blue tint to match the new hue; text stays dark for contrast.

## Technical detail

Single file: `src/styles.css`.

- Update the brand token block in `:root`:
  - `--brand-navy` → deep shade of the reference blue, `oklch(0.42 0.115 245)`
  - `--brand-blue` → the reference blue itself, `oklch(0.52 0.13 245)`
  - `--brand-surface` / `--background` → blue-tinted neutrals at the same hue (245)
  - `--accent` and `--ring` → light blue tint instead of `--brand-orange`
  - `--sidebar`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` → blue family values
  - `--chart-*` → blue-family sequence, keeping green/red for status charts
- Keep `--brand-orange` and `--brand-green` defined so any direct references still resolve.
- No component files are touched.

## Verification

- Run the build.
- Visually check dashboard, sidebar, login, and a dialog for contrast in the new palette.
