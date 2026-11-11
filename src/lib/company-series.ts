export interface SeriesInput { series: string; range_from: number | string; range_to: number | string }

/** Validates and normalizes a Range row: Series, From and To are required and From <= To. */
export function cleanSeries(d: SeriesInput) {
  const series = String(d.series ?? "").trim();
  if (!series) throw new Error("Series is required");
  const fromS = String(d.range_from ?? "").trim();
  const toS = String(d.range_to ?? "").trim();
  if (!fromS) throw new Error("From is required");
  if (!toS) throw new Error("To is required");
  if (!/^\d+$/.test(fromS) || !/^\d+$/.test(toS)) throw new Error("From and To must be numbers");
  const range_from = Number(fromS);
  const range_to = Number(toS);
  if (range_from > range_to) throw new Error("From must not be greater than To");
  return { series, range_from, range_to };
}
