import { describe, it, expect } from "vitest";
import { matchesApproverSearch } from "./approver-search";
const row = { userId: "9007", name: "Sunil Kumar", department: "Finance", designation: "HR Manager" };
describe("matchesApproverSearch", () => {
  it("empty query matches", () => expect(matchesApproverSearch("  ", row)).toBe(true));
  it("by user id", () => expect(matchesApproverSearch("900", row)).toBe(true));
  it("by name", () => expect(matchesApproverSearch("sunil", row)).toBe(true));
  it("by department", () => expect(matchesApproverSearch("FIN", row)).toBe(true));
  it("by designation", () => expect(matchesApproverSearch("manager", row)).toBe(true));
  it("no match", () => expect(matchesApproverSearch("xyz", row)).toBe(false));
});
