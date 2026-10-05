import { describe, expect, it } from "vitest";
import { parseApprovalPrintDetail, resolveApprovalPrintDocument } from "./approval-print-document";

describe("Approvals Print Form data", () => {
  it("parses nested stringified SAP responses", () => {
    const response = JSON.stringify({ body: JSON.stringify({ data: [{ REFFLD: "100122", FUNCT: "BUDGET DEVIATION" }] }) });
    expect(parseApprovalPrintDetail(response).detail).toMatchObject({ REFFLD: "100122", FUNCT: "BUDGET DEVIATION" });
  });

  it("merges partial details without allowing blanks to erase worklist approval data", () => {
    const richHtml = '<p><strong>Details</strong></p><table><tbody><tr><td>1</td></tr></tbody></table><img src="data:image/png;base64,AA==">';
    const resolved = resolveApprovalPrintDocument({
      editDetail: { CC_TEXT: "Ramky Estates & Farms Ltd", FUNCT: "", SUBJECT: "SAP subject" },
      selectDetail: { CC_CODE: "9000", PSPNR: "9000", NAME1: "REFL - Head Office", FUNCT: "BUDGET DEVIATION" },
      worklistRow: {
        BEGDA: "11.09.2026", INIT_NAME: "Initiator", EXTR_TXT: "PROJECTS",
        DESIG1: "DIRE-PROJ", USERID1: "1001", APPR1: "Approver One",
      },
      draft: { subject: "Saved subject", detailed_description: richHtml },
      comments: [],
      initiatorName: "Application Creator",
    });

    expect(resolved.document).toMatchObject({
      companyCode: "9000",
      companyName: "Ramky Estates & Farms Ltd",
      nfaType: "BUDGET DEVIATION",
      initiator: "Application Creator",
      subject: "SAP subject",
      description: richHtml,
    });
    expect(resolved.document.approvers[0]).toMatchObject({ role: "DIRE-PROJ", userId: "1001", name: "Approver One" });
    expect(resolved.comments).toEqual([{ name: "Approver One", text: "" }]);
    expect(resolved.missingFields).toEqual([]);
  });

  it("uses only the application-resolved creator for the Initiator field", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: { INIT_NAME: "SAP Initiator", SUBJECT: "Test" },
      worklistRow: { CREATED_BY: "SAP Creator" },
      initiatorName: "Saved Application Creator",
    });

    expect(resolved.document.initiator).toBe("Saved Application Creator");
    expect(resolveApprovalPrintDocument({
      editDetail: { INIT_NAME: "SAP Initiator" },
    }).document.initiator).toBe("");
  });

  it("keeps sparse levels and resolves the alternate fields used by saved report rows", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: {
        REFFLD: "100122", CC_TEXT: "Ramky Estates & Farms Ltd", PSPNR: "9000",
        BEGDA: "11.09.2026", FUNCT: "BUDGET DEVIATION", EXTR_TXT: "PROJECTS", SUBJECT: "TEST1",
      },
      worklistRow: {
        DESIGNATION1: "DIRE-PROJ", APPROVER1: "Approver One", USER_ID_1: "1001",
        DESIGNATION4: "GRP. CFO", APPROVER4: "Approver Four", USERID_4: "1004",
      },
      comments: [],
    });

    expect(resolved.document.approvers).toEqual([
      expect.objectContaining({ role: "DIRE-PROJ", userId: "1001", name: "Approver One" }),
      expect.objectContaining({ role: "GRP. CFO", userId: "1004", name: "Approver Four" }),
    ]);
    expect(resolved.comments).toEqual([
      { name: "Approver One", text: "" },
      { name: "Approver Four", text: "" },
    ]);
  });

  it("uses the Reports row to restore approver names when the approval worklist omits them", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: { REFFLD: "100122", PSPNR: "9000", FUNCT: "BUDGET DEVIATION", SUBJECT: "TEST1" },
      selectDetail: {
        REFFLD: "100122",
        ROLE1: "DIRE-PROJ", APPR1: "Mareddy Suresh",
        ROLE2: "CFO", APPR2: "ABAPER Narender",
        ROLE3: "REG. HEAD", APPR3: "Ranjit Kumar Neela",
        ROLE4: "GRP. CFO", APPR4: "D Sreenivasulu",
      },
      worklistRow: { REFFLD: "100122", SUBJECT: "TEST1" },
      comments: [],
    });

    expect(resolved.document.approvers.map(({ role, name }) => ({ role, name }))).toEqual([
      { role: "DIRE-PROJ", name: "Mareddy Suresh" },
      { role: "CFO", name: "ABAPER Narender" },
      { role: "REG. HEAD", name: "Ranjit Kumar Neela" },
      { role: "GRP. CFO", name: "D Sreenivasulu" },
    ]);
    expect(resolved.comments.map((comment) => comment.name)).toEqual([
      "Mareddy Suresh", "ABAPER Narender", "Ranjit Kumar Neela", "D Sreenivasulu",
    ]);
  });

  it("restores Function and every approval level from the original saved NFA when SAP omits them", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: { REFFLD: "100145", PSPNR: "9000", FUNCT: "BUDGET DEVIATION", SUBJECT: "Testing" },
      worklistRow: { REFFLD: "100145", SUBJECT: "Testing" },
      savedDetail: {
        EXTR_TXT: "PROJECTS",
        ROLE1: "Initiator Manager", USERID1: "1001", APPR1: "Approver One", STAT1: "approved",
        ROLE2: "Finance", USERID2: "1002", APPR2: "Approver Two", STAT2: "pending",
        ROLE3: "Regional Head", USERID3: "1003", APPR3: "Approver Three", STAT3: "pending",
      },
      initiatorName: "Application Creator",
    });

    expect(resolved.document.functionName).toBe("PROJECTS");
    expect(resolved.document.approvers).toEqual([
      expect.objectContaining({ role: "Initiator Manager", userId: "1001", name: "Approver One", status: "approved" }),
      expect.objectContaining({ role: "Finance", userId: "1002", name: "Approver Two", status: "pending" }),
      expect.objectContaining({ role: "Regional Head", userId: "1003", name: "Approver Three", status: "pending" }),
    ]);
    expect(resolved.missingFields).not.toContain("Function");
    expect(resolved.missingFields).not.toContain("Approval Chain");
  });

  it("keeps current SAP approval data ahead of saved fallback values", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: { EXTR_TXT: "SAP FUNCTION", ROLE1: "SAP ROLE", APPR1: "SAP Approver" },
      savedDetail: { EXTR_TXT: "SAVED FUNCTION", ROLE1: "SAVED ROLE", APPR1: "Saved Approver" },
    });

    expect(resolved.document.functionName).toBe("SAP FUNCTION");
    expect(resolved.document.approvers[0]).toMatchObject({ role: "SAP ROLE", name: "SAP Approver" });
  });

  it("fills every omitted SAP approval field from the complete saved chain", () => {
    const resolved = resolveApprovalPrintDocument({
      editDetail: {
        EXTR_TXT: "SAP FUNCTION",
        ROLE1: "SAP Level One",
        APPR1: "Current SAP Approver",
      },
      savedDetail: {
        EXTR_TXT: "SAVED FUNCTION",
        ROLE1: "Saved Level One", USERID1: "1001", APPR1: "Saved Approver One", STAT1: "approved",
        ROLE2: "Saved Level Two", USERID2: "1002", APPR2: "Saved Approver Two", STAT2: "pending",
        ROLE3: "Saved Level Three", USERID3: "1003", APPR3: "Saved Approver Three", STAT3: "pending",
      },
    });

    expect(resolved.document.functionName).toBe("SAP FUNCTION");
    expect(resolved.document.approvers).toEqual([
      expect.objectContaining({ role: "SAP Level One", userId: "1001", name: "Current SAP Approver", status: "approved" }),
      expect.objectContaining({ role: "Saved Level Two", userId: "1002", name: "Saved Approver Two", status: "pending" }),
      expect.objectContaining({ role: "Saved Level Three", userId: "1003", name: "Saved Approver Three", status: "pending" }),
    ]);
    expect(resolved.missingFields).not.toContain("Function");
    expect(resolved.missingFields).not.toContain("Approval Chain");
  });
});