import { describe, expect, it } from "vitest";
import { approvalChainResponseMessage, buildApprovalChainPayload, type EditableApprovalChain } from "./sap-approval-chain";
import { parseApprovalChains } from "./sap/master";

const chain: EditableApprovalChain = {
  pspnr: "9000",
  funct: "BUDGET DEVIATION",
  extraTxt: "PROJECTS",
  begda: "2026-10-01",
  endda: "9999-12-31",
  lineIndex: "12",
  levels: [
    { designation: "Abaper", userId: "SIPL_QM" },
    { designation: "CFO", userId: "ABAPCON2" },
  ],
};

describe("SAP approval chain management", () => {
  it("maps dynamic levels and clears every unused SAP slot", () => {
    expect(buildApprovalChainPayload(chain)).toEqual({
      create_user: {
        pspnr: "9000",
        Funct: "BUDGET DEVIATION",
        EXTR_TXT: "PROJECTS",
        BEGDA: "20261001",
        endda: "99991231",
        DESIG1: "Abaper",
        USERID1: "SIPL_QM",
        DESIG2: "CFO",
        USERID2: "ABAPCON2",
        DESIG3: "", USERID3: "",
        DESIG4: "", USERID4: "",
        DESIG5: "", USERID5: "",
        DESIG6: "", USERID6: "",
        DESIG7: "", USERID7: "",
        LINE_INDEX: "12",
      },
    });
  });

  it("builds deletion as the same identity with empty approval slots", () => {
    const payload = buildApprovalChainPayload(chain, "delete").create_user;
    expect(payload.LINE_INDEX).toBe("12");
    expect(payload.DESIG1).toBe("");
    expect(payload.USERID7).toBe("");
  });

  it("rejects incomplete and duplicate levels before sending", () => {
    expect(() => buildApprovalChainPayload({ ...chain, levels: [{ designation: "CFO", userId: "" }] }))
      .toThrow("Level 1 requires both Designation and User ID");
    expect(() => buildApprovalChainPayload({
      ...chain,
      levels: [{ designation: "A", userId: "SIPL_QM" }, { designation: "B", userId: "sipl_qm" }],
    })).toThrow("The same user cannot appear on two approval levels");
  });

  it("surfaces SAP business errors even when HTTP succeeds", () => {
    expect(approvalChainResponseMessage([{ TYPE: "E", MESSAGE: "Data Not Inserted" }]))
      .toEqual({ ok: false, message: "Data Not Inserted" });
  });

  it("loads the SAP line identity needed for later updates and deletion", () => {
    const parsed = parseApprovalChains([{ ...buildApprovalChainPayload(chain).create_user, LINE_INDEX: "12" }]);
    expect(parsed[0]?.lineIndex).toBe("12");
    expect(parsed[0]?.levels).toHaveLength(2);
  });
});