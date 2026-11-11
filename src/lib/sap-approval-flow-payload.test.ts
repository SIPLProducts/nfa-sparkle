import { parseSapApprovalFlow } from "@/lib/sap-approval-flow";
import { formatApproverDate } from "@/components/document/EnfaDocument";
import { describe, expect, it } from "vitest";
import { buildApprovalFlowPayload } from "./sap-api-constants";

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

describe("approval chain date", () => {
  it("check X adds enfa_no when the NFA number is known, other fields kept", () => {
    const p = buildApprovalFlowPayload({}, { check: "X", plant: "9000", nfaType: "BUDGET DEVIATION", funct: "PROJECTS", enfaNo: "100226" });
    expect(p).toEqual({ check: "X", plant: "9000", nfa_type: "BUDGET DEVIATION", funct: "PROJECTS", enfa_no: "100226" });
  });
  it("maps DATE1..3 and formats them", () => {
    const a = parseSapApprovalFlow({ DESIG1: "SCM HEAD", USERID1: "9002", DATE1: "2026-10-26", DESIG2: "site head", USERID2: "1001", DATE2: "2026-10-27" });
    expect(a.map((x) => x.actedDate)).toEqual(["2026-10-26", "2026-10-27"]);
    expect(formatApproverDate("2026-10-26")).toBe("26.10.2026");
    expect(formatApproverDate("0000-00-00")).toBe("");
  });
});
