import { describe, it, expect } from "vitest";
import { cleanSeries } from "./company-series";

describe("cleanSeries", () => {
  it("accepts 9000 from 9000 to 9499", () =>
    expect(cleanSeries({ series: " 9000 ", range_from: "9000", range_to: "9499" })).toEqual({ series: "9000", range_from: 9000, range_to: 9499 }));
  it("requires Series", () => expect(() => cleanSeries({ series: "", range_from: 1, range_to: 2 })).toThrow("Series is required"));
  it("requires From", () => expect(() => cleanSeries({ series: "1", range_from: "", range_to: 2 })).toThrow("From is required"));
  it("requires To", () => expect(() => cleanSeries({ series: "1", range_from: 1, range_to: "" })).toThrow("To is required"));
  it("rejects From greater than To", () => expect(() => cleanSeries({ series: "1000", range_from: 1999, range_to: 1000 })).toThrow("From must not be greater than To"));
});
