import { describe, it, expect } from "vitest";
import { filterCompaniesForUser } from "./company-groups";

const all = ["1000", "1999", "2000", "4000", "4199", "4200", "9000", "9301", "9499", "9500", "9599"].map((code) => ({ code, name: code }));
const codes = (u: string | null) => filterCompaniesForUser(u, all).map((c) => c.code);

describe("company groups", () => {
  it("9000-9499", () => expect(codes("9001")).toEqual(["9000", "9301", "9499"]));
  it("9500-9599", () => expect(codes("9500")).toEqual(["9500", "9599"]));
  it("1000-1999", () => expect(codes("1101")).toEqual(["1000", "1999"]));
  it("4000-4199", () => expect(codes("4000")).toEqual(["4000", "4199"]));
  it("no company", () => expect(codes(null)).toEqual([]));
  it("outside ranges", () => expect(codes("2000")).toEqual([]));
});
