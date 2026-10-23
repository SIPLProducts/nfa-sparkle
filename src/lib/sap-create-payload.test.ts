import { describe, expect, it } from "vitest";
import { approverModeCheck, wrapCreatePayload } from "./sap-api-constants";

describe("Create ENFA payload", () => {
  it("Predefined sends check X", () => expect(approverModeCheck("predefined")).toBe("X"));
  it("Dynamic sends blank check", () => expect(approverModeCheck("dynamic")).toBe(""));
  it("fills selected approvers in order, rest blank", () => {
    const { create } = wrapCreatePayload({ CC_code: "9000" }, [], "SIPL_QM", {
      approvers: [{ designation: "BU Head", userId: "sipl_qm" }, { designation: "CFO", userId: "U2" }],
      check: "X",
    });
    expect(create.design1).toBe("BU Head");
    expect(create.approve1).toBe("SIPL_QM");
    expect(create.approve2).toBe("U2");
    expect(create.approve3).toBe("");
    expect(create.design15).toBe("");
    expect(create.check).toBe("X");
    expect(create.user_name).toBe("SIPL_QM");
  });
  it("rejects more than 15 approvers", () => {
    const many = Array.from({ length: 16 }, (_, i) => ({ designation: "D", userId: `U${i}` }));
    expect(() => wrapCreatePayload({}, [], "X", { approvers: many, check: "" })).toThrow();
  });
});
