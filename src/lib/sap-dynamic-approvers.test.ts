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

import { dynamicChainIds } from "./sap-dynamic-approvers";
describe("dynamicChainIds", () => {
  const recs = [
    { nfaNo: "100190", levels: [{ level: 1, designation: "BU Head", userId: "A1" }, { level: 2, designation: "PH", userId: "A2" }] },
    { nfaNo: "100191", levels: [{ level: 1, designation: "X", userId: "B1" }] },
  ];
  it("matches the ENFA by REFFLD", () => expect(dynamicChainIds(recs, "100190")).toEqual(["A1", "A2"]));
  it("ignores other NFAs", () => expect(dynamicChainIds(recs, "100191")).toEqual(["B1"]));
  it("returns empty when no match", () => expect(dynamicChainIds(recs, "999")).toEqual([]));
});
