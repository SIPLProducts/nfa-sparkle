import { describe, expect, it } from "vitest";
import { restrictToFlow } from "./sap-approval-flow";

const a = (level: number, userId: string, role = "", status = "") =>
  ({ level, role, userId, name: "", status, actedDate: "", actedTime: "" });

describe("restrictToFlow", () => {
  const saved = ["9001", "9002", "9003", "1001", "1002", "1003", "1004"].map((id, i) => a(i + 1, id, "R", id === "1001" ? "A" : ""));
  it("shows exactly the 3 approvers SAP returns for 100226", () => {
    const out = restrictToFlow(saved, [a(1, "9002", "SCM HEAD"), a(2, "1001", "site head"), a(3, "9001", "MANAGER")]);
    expect(out.map((x) => x.userId)).toEqual(["9002", "1001", "9001"]);
    expect(out[1].status).toBe("A");
  });
  it("falls back to the saved chain when SAP returns none", () => {
    expect(restrictToFlow(saved, [])).toHaveLength(7);
  });
});
