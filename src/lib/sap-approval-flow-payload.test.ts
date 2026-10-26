import { describe, expect, it } from "vitest";
import { buildApprovalFlowPayload } from "./sap-api-constants";
import { parseSapApprovalFlow } from "./sap-approval-flow";

const base = { plant: "9000", nfaType: "BUDGET DEVIATION", funct: "PROJECTS", enfaNo: "100221" };

describe("approval flow payload", () => {
  it("predefined X never sends enfa_no", () => {
    const p = buildApprovalFlowPayload({ enfa_no: "" }, { ...base, check: "X" });
    expect(p).toEqual({ check: "X", plant: "9000", nfa_type: "BUDGET DEVIATION", funct: "PROJECTS" });
  });
  it("dynamic sends only enfa_no", () => {
    const p = buildApprovalFlowPayload({}, { ...base, check: "" });
    expect(p).toEqual({ check: "", plant: "", nfa_type: "", funct: "", enfa_no: "100221" });
  });
  it("reads the dynamic reply for 100221 as 3 levels", () => {
    const a = parseSapApprovalFlow([{ MANDT: "300", REFFLD: "100221", DESIG1: "site head", USERID1: "1001", DESIG2: "MANAGER", USERID2: "9001", DESIG3: "HR MANGAER", USERID3: "9002", DESIG4: "", USERID4: "" }]);
    expect(a.map((x) => x.userId)).toEqual(["1001", "9001", "9002"]);
  });
});
