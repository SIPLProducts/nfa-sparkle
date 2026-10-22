import { describe, expect, it } from "vitest";
import { buildApprovalChainPayload } from "./sap-approval-chain";

const base = { pspnr: "9000", funct: "BUDGET DEVIATION", extraTxt: "PROJECTS", begda: "20261001", endda: "99991231", lineIndex: "" };
const levels = (n: number) => Array.from({ length: n }, (_, i) => ({ designation: `D${i + 1}`, userId: `U${i + 1}` }));

describe("15 approver slots", () => {
  it("sends DESIG1..15 with blanks for unused slots", () => {
    const p = buildApprovalChainPayload({ ...base, levels: [{ designation: "Abaper", userId: "SIPL_QM" }] });
    expect(p.create_user).toMatchObject({ DESIG1: "Abaper", USERID1: "SIPL_QM", DESIG15: "", USERID15: "" });
    expect(p.create_user).not.toHaveProperty("DESIG16");
  });
  it("accepts 15 levels", () => {
    expect(buildApprovalChainPayload({ ...base, levels: levels(15) }).create_user.USERID15).toBe("U15");
  });
  it("rejects 16 levels", () => {
    expect(() => buildApprovalChainPayload({ ...base, levels: levels(16) })).toThrow();
  });
});
