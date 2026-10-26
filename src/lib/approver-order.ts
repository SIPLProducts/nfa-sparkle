/** Adds or removes a row index, keeping the order in which rows were ticked. */
export function toggleOrdered(order: number[], i: number): number[] {
  return order.includes(i) ? order.filter((x) => x !== i) : [...order, i];
}

/** Rows in tick order, renumbered as levels 1..n. */
export function orderSelected<T extends { level: number }>(rows: T[], order: number[]): T[] {
  return order.filter((i) => rows[i]).map((i, n) => ({ ...rows[i], level: n + 1 }));
}
