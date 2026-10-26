import { describe, it, expect } from "vitest";
import { orderSelected, toggleOrdered } from "./approver-order";

const rows = [
  { level: 1, userId: "9001" },
  { level: 2, userId: "9002" },
  { level: 3, userId: "9003" },
];

describe("approver tick order", () => {
  it("ticking 9003 then 9001 makes 9003 level 1", () => {
    const order = toggleOrdered(toggleOrdered([], 2), 0);
    expect(orderSelected(rows, order)).toEqual([{ level: 1, userId: "9003" }, { level: 2, userId: "9001" }]);
  });
  it("unticking renumbers the rest", () => {
    const order = toggleOrdered([2, 0, 1], 0);
    expect(orderSelected(rows, order)).toEqual([{ level: 1, userId: "9003" }, { level: 2, userId: "9002" }]);
  });
});
