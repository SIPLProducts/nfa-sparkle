import { describe, it, expect } from "vitest";
import { buildApproverGetDetailPayload } from "./sap-api-constants";
import { parseApprovalChains } from "./sap/master";
import { pickApprovalChain } from "./sap-approval-flow";

const sample = [{
  MANDT: "300", PSPNR: "9000", FUNCT: "SCM ITEMS", EXTR_TXT: "SCM", BEGDA: "2025-04-01", ENDDA: "9999-12-31",
  DESIG1: "SCM HEAD", USERID1: "22012284", DESIG2: "DIRE-PROJ", USERID2: "22007746", DESIG3: "CFO", USERID3: "22011580",
  DESIG4: "REG. HEAD", USERID4: "ABAPCON2", DESIG5: "GROUP CFO", USERID5: "22011580",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [[`DESIG${i + 6}`, ""], [`USERID${i + 6}`, ""]]).flat()),
}];

describe("Approver get_detail", () => {
  it("builds predefined payload", () => {
    expect(buildApproverGetDetailPayload("X", "9000")).toEqual({ get_detail: { check: "X", plant: "9000" } });
  });
  it("builds dynamic payload", () => {
    expect(buildApproverGetDetailPayload("", "9000")).toEqual({ get_detail: { check: "", plant: "9000" } });
  });
  it("parses sample response into 5 levels", () => {
    const r = pickApprovalChain(parseApprovalChains(sample), { plant: "9000", nfaType: "SCM ITEMS", functionName: "SCM" });
    expect(r.approvers.map((a) => a.userId)).toEqual(["22012284", "22007746", "22011580", "ABAPCON2", "22011580"]);
    expect(r.approvers[3].role).toBe("REG. HEAD");
  });
});

import { filterApproverChains } from "./sap-approval-flow";
describe("Plant-only approver listing", () => {
  const chains = parseApprovalChains([...sample, { ...sample[0], FUNCT: "CAPEX", EXTR_TXT: "FIN" }]);
  it("lists all plant chains before NFA Type is chosen", () => {
    expect(filterApproverChains(chains, { plant: "9000", nfaType: "", functionName: "" })).toHaveLength(2);
  });
  it("narrows to the chosen type and function", () => {
    const r = filterApproverChains(chains, { plant: "9000", nfaType: "SCM ITEMS", functionName: "SCM" });
    expect(r).toHaveLength(1);
    expect(r[0].levels).toHaveLength(5);
  });
});

import { APPROVER_DETAIL_ENDPOINT_NAMES } from "./sap-api-constants";
it("prefers the 'Dynamic Approvals' API Settings entry", () => {
  expect(APPROVER_DETAIL_ENDPOINT_NAMES[0]).toBe("Dynamic Approvals");
});

import { MIN_CREATE_APPROVERS } from "./sap-api-constants";
it("requires at least 2 approvers on Create NFA", () => {
  expect(MIN_CREATE_APPROVERS).toBe(2);
});

import { approverModeCheck } from "./sap-api-constants";
it("Predefined sends check X, Dynamic sends blank", () => {
  expect(approverModeCheck("predefined")).toBe("X");
  expect(approverModeCheck("dynamic")).toBe("");
});

import { vi } from "vitest";
import { fetchSapApproverChains } from "./sap-approval-flow";
it("Dynamic failure never calls the Approval Chain API", async () => {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ error: "Dynamic Approvals endpoint is not registered" }), { status: 424 });
  }));
  await expect(fetchSapApproverChains({ plant: "9000", check: "" }, "t")).rejects.toThrow(/not registered/);
  expect(calls).toEqual(["/api/public/sap-approver-detail"]);
  vi.unstubAllGlobals();
});
