import { describe, expect, it } from "vitest";
import { buildDynamicApproversListPayload, parseDynamicApprovers } from "./sap-dynamic-approvers";

describe("dynamic approvers list", () => {
  it("sends blank for all and the NFA number for one", () => {
    expect(buildDynamicApproversListPayload()).toEqual({ dynamic_approvers: "" });
    expect(buildDynamicApproversListPayload(" 100190 ")).toEqual({ dynamic_approvers: "100190" });
  });

  it("parses the supplied sample into 2 levels", () => {
    const row: Record<string, string> = { MANDT: "300", REFFLD: "100190", DESIG1: "BU Head", USERID1: "SIPL_QM", DESIG2: "Project He", USERID2: "SIPL_QM" };
    for (let i = 3; i <= 15; i++) { row[`DESIG${i}`] = ""; row[`USERID${i}`] = ""; }
    const out = parseDynamicApprovers(JSON.stringify([row]));
    expect(out).toEqual([{ nfaNo: "100190", levels: [
      { level: 1, designation: "BU Head", userId: "SIPL_QM" },
      { level: 2, designation: "Project He", userId: "SIPL_QM" },
    ] }]);
  });
});
