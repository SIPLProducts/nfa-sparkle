import { describe, expect, it } from "vitest";
import { withApproverNames } from "./approver-names";
import { buildCreateApproverSlots } from "./sap-api-constants";

describe("approver names in create payload", () => {
  it("fills name01, name2, name3 from portal names", () => {
    const approvers = withApproverNames(
      [
        { designation: "site head", userId: "1001" },
        { designation: "MANAGER", userId: "9001" },
        { designation: "HR MANGAER", userId: "9002" },
      ],
      { "1001": { name: "akash A" }, "9001": { name: "thiru sharvi" }, "9002": { name: "prasad sharvi" } },
    );
    const slots = buildCreateApproverSlots(approvers);
    expect(slots.name01).toBe("akash A");
    expect(slots.name2).toBe("thiru sharvi");
    expect(slots.name3).toBe("prasad sharvi");
    expect(slots.approve1).toBe("1001");
  });

  it("leaves the name empty when the approver is not a portal user", () => {
    const [a] = withApproverNames([{ userId: "7777" }], { "1001": { name: "akash A" } });
    expect(a.name).toBe("");
  });
});
