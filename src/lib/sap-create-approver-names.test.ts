import { describe, it, expect } from "vitest";
import { wrapCreatePayload } from "./sap-api-constants";

describe("Create ENFA approver name slots", () => {
  const { create } = wrapCreatePayload(
    { NAME1: "REFL - Head Office" },
    [],
    "SIPL_QM",
    { approvers: [{ designation: "BU Head", userId: "sipl_qm", name: "Quality Manager" }, { designation: "CFO", userId: "cfo1", name: "Finance Head" }], check: "" },
  ) as { create: Record<string, unknown> };

  it("puts approver 1's name in name01, keeping the plant name separate", () => {
    expect(create["name01"]).toBe("Quality Manager");
    expect(create["NAME1"]).toBe("REFL - Head Office");
  });

  it("fills name2 for approver 2 and leaves name3..name15 empty", () => {
    expect(create["name2"]).toBe("Finance Head");
    for (let i = 3; i <= 15; i++) expect(create[`name${i}`]).toBe("");
  });
});
