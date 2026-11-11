import { describe, it, expect } from "vitest";
import { filterCompaniesByRange, pickSeriesRange } from "./company-groups";

const all = ["1000", "1999", "2000", "4000", "9000", "9101", "9499", "9990", "9995"].map((code) => ({ code, name: code }));
const ranges = [
  { series: "9000", range_from: 1000, range_to: 9990 },
  { series: "4000", range_from: 4000, range_to: 4199 },
];
const codes = (s: string | null, c: string | null, r = ranges) => filterCompaniesByRange(pickSeriesRange(s, c, r), all).map((x) => x.code);

describe("company series ranges", () => {
  it("1000-9990 includes 9101", () =>
    expect(codes("9000", "9000")).toEqual(["1000", "1999", "2000", "4000", "9000", "9101", "9499", "9990"]));
  it("saved series wins over company code", () => expect(codes("4000", "9000")).toEqual(["4000"]));
  it("falls back to range containing company code", () => expect(codes(null, "4100")).toEqual(["1000", "1999", "2000", "4000", "9000", "9101", "9499", "9990"]));
  it("respects edited range", () => expect(codes("9000", null, [{ series: "9000", range_from: 9000, range_to: 9499 }])).toEqual(["9000", "9101", "9499"]));
  it("no match is empty", () => expect(codes(null, "9995")).toEqual([]));
});
