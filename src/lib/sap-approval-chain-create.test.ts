import { describe, expect, it } from "vitest";
import { approvalChainResponseMessage, buildApprovalChainPayload } from "./sap-approval-chain";

describe("Create Approvals payload", () => {
  it("matches SAP sample", () => {
    const p = buildApprovalChainPayload({ pspnr: "9000", funct: "BUDGET DEVIATION", extraTxt: "PROJECTS", begda: "2026-10-02", endda: "9999-12-31", lineIndex: "", levels: [{ designation: "Abaper", userId: "SIPL_QM" }] });
    expect(p.create_user).toMatchObject({ pspnr: "9000", Funct: "BUDGET DEVIATION", EXTR_TXT: "PROJECTS", BEGDA: "20261002", endda: "99991231", DESIG1: "Abaper", USERID1: "SIPL_QM", DESIG7: "", USERID7: "" });
    expect(Object.values(p)[0]).not.toHaveProperty("LINE_INDEX");
  });
  it("reads success", () => {
    expect(approvalChainResponseMessage('[{"TYPE":"S","MESSAGE":"Data Inserted Successfully"}]')).toEqual({ ok: true, message: "Data Inserted Successfully" });
  });
});

describe("Update Approvals payload", () => {
  it("wraps in Update_user", () => {
    const p = buildApprovalChainPayload({ pspnr: "9000", funct: "BUDGET DEVIATION", extraTxt: "PROJECTS", begda: "20261001", endda: "99991231", lineIndex: "", levels: [{ designation: "Abaper", userId: "SIPL_QM" }, { designation: "abaper2", userId: "sipl_qm1" }] }, "update");
    expect(p["Update_user"]).toMatchObject({ BEGDA: "20261001", DESIG2: "abaper2", USERID2: "sipl_qm1", DESIG3: "" });
    expect(Object.values(p)[0]).not.toHaveProperty("LINE_INDEX");
    expect(approvalChainResponseMessage([{ TYPE: "S", MESSAGE: "Data Updated Successfully" }])).toEqual({ ok: true, message: "Data Updated Successfully" });
  });
});

describe("Delete Approvals payload", () => {
  const base = { pspnr: "9000", funct: "BUDGET DEVIATION", extraTxt: "PROJECTS", begda: "20261001", endda: "99991231", lineIndex: "" };
  it("matches SAP delete_user sample", () => {
    const p = buildApprovalChainPayload({ ...base, levels: [{ designation: "Abaper", userId: "SIPL_QM" }, { designation: "abaper2", userId: "sipl_qm1" }] }, "delete") as unknown as { delete_user: Record<string, string> };
    expect(p.delete_user).toMatchObject({ PSPNR: "9000", FUNCT: "BUDGET DEVIATION", EXTR_TXT: "PROJECTS", BEGDA: "2026-10-01", ENDDA: "9999-12-31", DESIG1: "Abaper", USERID1: "SIPL_QM", DESIG2: "abaper2", USERID2: "sipl_qm1", DESIG3: "", USERID15: "" });
    expect(p.delete_user).toHaveProperty("MANDT");
    expect(p.delete_user).not.toHaveProperty("LINE_INDEX");
  });
  it("sends all 15 approvers", () => {
    const levels = Array.from({ length: 15 }, (_, i) => ({ designation: `D${i + 1}`, userId: `U${i + 1}` }));
    const p = buildApprovalChainPayload({ ...base, levels }, "delete") as unknown as { delete_user: Record<string, string> };
    expect(p.delete_user.USERID15).toBe("U15");
    expect(p.delete_user.DESIG15).toBe("D15");
  });
});
