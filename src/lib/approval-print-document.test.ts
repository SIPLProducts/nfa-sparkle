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
      selectDetail: { PSPNR: "9000", NAME1: "REFL - Head Office", FUNCT: "BUDGET DEVIATION" },
      worklistRow: {
        BEGDA: "11.09.2026", INIT_NAME: "Initiator", EXTR_TXT: "PROJECTS",
        DESIG1: "DIRE-PROJ", USERID1: "1001", APPR1: "Approver One",
      },
      draft: { subject: "Saved subject", detailed_description: richHtml },
      comments: [],
    });

    expect(resolved.document).toMatchObject({
      companyName: "Ramky Estates & Farms Ltd",
      nfaType: "BUDGET DEVIATION",
      subject: "SAP subject",
      description: richHtml,
    });
    expect(resolved.document.approvers[0]).toMatchObject({ role: "DIRE-PROJ", userId: "1001", name: "Approver One" });
    expect(resolved.comments).toEqual([{ name: "Approver One", text: "" }]);
    expect(resolved.missingFields).toEqual([]);
  });
});