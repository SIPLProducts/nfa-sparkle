import { parseSapApprovalFlow } from "@/lib/sap-approval-flow";
import { formatApproverDate } from "@/components/document/EnfaDocument";
import { describe, expect, it } from "vitest";
import { buildApprovalFlowPayload } from "./sap-api-constants";

const base = { plant: "9000", nfaType: "BUDGET DEVIATION", funct: "PROJECTS", enfaNo: "100221" };

describe("approval flow payload", () => {
  it("predefined X without an NFA number sends no enfa_no", () => {
    const p = buildApprovalFlowPayload({ enfa_no: "" }, { ...base, enfaNo: "", check: "X" });
    expect(p).toEqual({ check: "X", plant: "9000", nfa_type: "BUDGET DEVIATION", funct: "PROJECTS" });
  });
  it("dynamic sends only enfa_no", () => {
    const p = buildApprovalFlowPayload({}, { ...base, check: "" });
    expect(p).toEqual({ check: "", plant: "9000", nfa_type: "", funct: "", enfa_no: "100221" });
  });
  it("reads the dynamic reply for 100221 as 3 levels", () => {
    const a = parseSapApprovalFlow([{ MANDT: "300", REFFLD: "100221", DESIG1: "site head", USERID1: "1001", DESIG2: "MANAGER", USERID2: "9001", DESIG3: "HR MANGAER", USERID3: "9002", DESIG4: "", USERID4: "" }]);
    expect(a.map((x) => x.userId)).toEqual(["1001", "9001", "9002"]);
  });
});

describe("werks template (SAP API Settings)", () => {
  const tpl = { check: "X", werks: "9000", nfa_type: "BUDGET DEVIATION", funct: "PROJECTS", enfa_no: "100226" };
  it("dynamic 100270 matches the Postman body", () => {
    const p = buildApprovalFlowPayload(tpl, { check: "", plant: "9000", nfaType: "", funct: "", enfaNo: "100270" });
    expect(p).toEqual({ check: "", werks: "9000", nfa_type: "", funct: "", enfa_no: "100270" });
  });
  it("predefined sends the NFA's own plant, not the template's", () => {
    const p = buildApprovalFlowPayload(tpl, { ...base, plant: "4000", check: "X" });
    expect(p.werks).toBe("4000");
    expect(p).not.toHaveProperty("plant");
  });
  it("reads the Postman reply for 100270", () => {
    const a = parseSapApprovalFlow({ MANDT: "300", PSPNR: "9000", FUNCT: "", BEGDA: "2026-11-11", DESIG1: "site head", USERID1: "1001", DATE1: "2026-11-11", DESIG2: "SCM HEAD", USERID2: "9002", DATE2: "" });
    expect(a.map((x) => [x.role, x.userId])).toEqual([["site head", "1001"], ["SCM HEAD", "9002"]]);
    expect(a[0].actedDate).toBe("2026-11-11");
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

describe("placeholder slots", () => {
  it("drops slots with only a -- date", () => {
    const a = parseSapApprovalFlow({ DESIG1: "HR", USERID1: "9007", DATE1: "2026-11-17", DESIG2: "HR", USERID2: "9005", DATE2: "--", DESIG3: "", USERID3: "", DATE3: "--", DATE15: "--" });
    expect(a.map((x) => x.userId)).toEqual(["9007", "9005"]);
    expect(formatApproverDate("--")).toBe("");
  });
});
