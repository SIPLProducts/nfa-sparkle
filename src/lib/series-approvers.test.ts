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
  it("excludes the signed-in user", () => {
    const out = filterSeriesApprovers("9000", [u("1", "9000"), u("2", "9000")], new Set(), "1");
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });
  it("returns nothing when the user has no series", () => expect(filterSeriesApprovers(null, [u("1", "9000")], new Set())).toEqual([]));
});

import { filterRangeApprovers, rangesOverlap } from "./series-approvers";
describe("filterRangeApprovers", () => {
  const rangeOf = new Map([["A", { from: 1000, to: 2000 }], ["B", { from: 1000, to: 9000 }], ["C", { from: 1000, to: 5000 }], ["D", { from: 3000, to: 4000 }]]);
  const u = (id: string, s: string) => ({ id, username: id, full_name: id, designation: "", company_series: s, status: "active", is_active: true });
  const users = [u("prasad", "A"), u("sunil", "B"), u("sampath", "C"), u("far", "D"), u("viewer", "B"), u("boss", "B")];
  const approvers = new Set(["prasad", "sunil", "sampath", "far", "boss"]);
  const run = () => filterRangeApprovers({ from: 1000, to: 2000 }, users, rangeOf, approvers, new Set(["boss"]), "prasad").map((x) => x.id);
  it("includes overlapping approvers (Sunil, Sampath)", () => expect(run()).toEqual(["sunil", "sampath"]));
  it("excludes non-overlapping range", () => expect(run()).not.toContain("far"));
  it("excludes non-approvers", () => expect(run()).not.toContain("viewer"));
  it("excludes admins even with approver role", () => expect(run()).not.toContain("boss"));
  it("excludes the initiator", () => expect(run()).not.toContain("prasad"));
  it("overlap rule", () => { expect(rangesOverlap({ from: 1, to: 5 }, { from: 5, to: 9 })).toBe(true); expect(rangesOverlap({ from: 1, to: 4 }, { from: 5, to: 9 })).toBe(false); });
});
