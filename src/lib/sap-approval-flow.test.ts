import { describe, expect, it } from "vitest";
import { mergeApprovalFlow, parseSapApprovalFlow } from "./sap-approval-flow";

const sapRow = {
  DESIG1: "DIRE-PROJ", USERID1: "22007746",
  DESIG2: "CFO", USERID2: "ABAPCON2",
  DESIG3: "REG. HEAD", USERID3: "22011077",
  DESIG4: "GRP. CFO", USERID4: "22011580",
  DESIG5: "", USERID5: "",
};

describe("SAP approval flow", () => {
  it("maps every populated designation and user ID in order", () => {
    expect(parseSapApprovalFlow([sapRow])).toEqual([
      { role: "DIRE-PROJ", userId: "22007746", name: "", status: "", actedDate: "", actedTime: "" },
      { role: "CFO", userId: "ABAPCON2", name: "", status: "", actedDate: "", actedTime: "" },
      { role: "REG. HEAD", userId: "22011077", name: "", status: "", actedDate: "", actedTime: "" },
      { role: "GRP. CFO", userId: "22011580", name: "", status: "", actedDate: "", actedTime: "" },
    ]);
  });

  it("unwraps nested and stringified SAP responses", () => {
    const wrapped = JSON.stringify({ body: JSON.stringify({ data: [sapRow] }) });
    expect(parseSapApprovalFlow(wrapped)).toHaveLength(4);
  });

  it("fills missing saved fields without losing names or status", () => {
    const merged = mergeApprovalFlow(
      [{ role: "", userId: "", name: "Approver One", status: "Pending" }],
      parseSapApprovalFlow([sapRow]),
    );
    expect(merged[0]).toMatchObject({ role: "DIRE-PROJ", userId: "22007746", name: "Approver One", status: "Pending" });
  });
});