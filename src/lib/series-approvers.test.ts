import { describe, it, expect } from "vitest";
import { pickCompanySeries, filterSeriesApprovers } from "./series-approvers";

const ranges = [
  { series: "9101", range_from: 1000, range_to: 9990 },
  { series: "9000", range_from: 9000, range_to: 9499 },
];
describe("pickCompanySeries", () => {
  it("finds the range containing the company", () => expect(pickCompanySeries("1000", ranges)).toBe("9101"));
  it("returns null when out of range", () => expect(pickCompanySeries("9995", ranges)).toBeNull());
  it("prefers the narrowest overlapping range", () => expect(pickCompanySeries("9100", ranges)).toBe("9000"));
});
describe("filterSeriesApprovers", () => {
  const u = (id: string, s: string) => ({ id, username: id, full_name: id, designation: "", company_series: s, status: "active", is_active: true });
  it("keeps only the series and drops admins", () => {
    const out = filterSeriesApprovers("9000", [u("1", "9000"), u("2", "9000"), u("3", "9101")], new Set(["2"]));
    expect(out.map((x) => x.id)).toEqual(["1"]);
  });
});
