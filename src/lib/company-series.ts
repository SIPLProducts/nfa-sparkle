export interface SeriesInput { series?: string; range_from: number | string; range_to: number | string }

/** Validates and normalizes a Range row: Series, From and To are required and From <= To. */
export function cleanSeries(d: SeriesInput) {
  const fromS = String(d.range_from ?? "").trim();
  const toS = String(d.range_to ?? "").trim();
  if (!fromS) throw new Error("From is required");
  if (!toS) throw new Error("To is required");
  if (!/^\d+$/.test(fromS) || !/^\d+$/.test(toS)) throw new Error("From and To must be numbers");
  const range_from = Number(fromS);
  const range_to = Number(toS);
  if (range_from > range_to) throw new Error("From must not be greater than To");
  // Ranges are identified by From–To; the internal key keeps existing user links intact.
  const series = String(d.series ?? "").trim() || `${range_from}-${range_to}`;
  return { series, range_from, range_to };
}

/** Display label for a Range row. */
export const rangeLabel = (r: { range_from: number; range_to: number }) => `${r.range_from}–${r.range_to}`;
