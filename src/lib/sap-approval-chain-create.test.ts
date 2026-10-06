import { describe, expect, it } from "vitest";
import { approvalChainResponseMessage, buildApprovalChainPayload } from "./sap-approval-chain";

describe("Create Approvals payload", () => {
  it("matches SAP sample", () => {
    const p = buildApprovalChainPayload({ pspnr: "9000", funct: "BUDGET DEVIATION", extraTxt: "PROJECTS", begda: "2026-10-02", endda: "9999-12-31", lineIndex: "", levels: [{ designation: "Abaper", userId: "SIPL_QM" }] });
    expect(p.create_user).toMatchObject({ pspnr: "9000", Funct: "BUDGET DEVIATION", EXTR_TXT: "PROJECTS", BEGDA: "20261002", endda: "99991231", DESIG1: "Abaper", USERID1: "SIPL_QM", DESIG7: "", USERID7: "", LINE_INDEX: "" });
  });
  it("reads success", () => {
    expect(approvalChainResponseMessage('[{"TYPE":"S","MESSAGE":"Data Inserted Successfully"}]')).toEqual({ ok: true, message: "Data Inserted Successfully" });
  });
});
