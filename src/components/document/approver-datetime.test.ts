import { describe, it, expect } from "vitest";
import { formatApproverDate, formatApproverTime } from "./EnfaDocument";
describe("approver date/time", () => {
  it("formats date", () => { expect(formatApproverDate("2026-11-11")).toBe("11.11.2026"); expect(formatApproverDate("0000-00-00")).toBe(""); });
  it("hides zero time", () => { expect(formatApproverTime("0:00:00")).toBe(""); expect(formatApproverTime("000000")).toBe(""); expect(formatApproverTime("143005")).toBe("14:30:05"); });
});
