import { describe, it, expect } from "vitest";
import { missingCreateFields } from "./nfa-required-fields";

const base = { company: "C1", subject: "S", nfaType: "", func: "" };

describe("missingCreateFields", () => {
  it("dynamic mode allows empty NFA Type and Function", () => {
    expect(missingCreateFields("dynamic", base)).toBeNull();
  });
  it("predefined mode requires NFA Type", () => {
    expect(missingCreateFields("predefined", base)).toMatch(/NFA Type/);
  });
  it("predefined mode requires Function", () => {
    expect(missingCreateFields("predefined", { ...base, nfaType: "T" })).toMatch(/Function/);
  });
  it("dynamic mode still requires Subject", () => {
    expect(missingCreateFields("dynamic", { ...base, subject: "" })).not.toBeNull();
  });
});
