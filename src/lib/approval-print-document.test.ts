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
    });

    expect(resolved.document).toMatchObject({
      companyCode: "9000",
      companyName: "Ramky Estates & Farms Ltd",
      nfaType: "BUDGET DEVIATION",
      subject: "SAP subject",
      description: richHtml,
    });
    expect(resolved.document.approvers[0]).toMatchObject({ role: "DIRE-PROJ", userId: "1001", name: "Approver One" });
    expect(resolved.comments).toEqual([{ name: "Approver One", text: "" }]);
    expect(resolved.missingFields).toEqual([]);
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
});