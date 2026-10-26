import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVER_DETAIL_ENDPOINT_NAMES } from "./sap-api-constants";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("Create vs Preview approver APIs", () => {
  it("Create lookup never matches the Preview approval-flow entry", () => {
    const name = "approval flow in detailed description";
    for (const pattern of APPROVER_DETAIL_ENDPOINT_NAMES) {
      const re = new RegExp("^" + pattern.toLowerCase().replace(/%/g, ".*") + "$");
      expect(re.test(name)).toBe(false);
    }
  });
  it("Create approvers window only calls the get_detail route", () => {
    const s = src("../components/nfa/ApproverSelector.tsx");
    expect(s).not.toMatch(/fetchSapApprovalFlow|fetchResolvedSapApprovalFlow|sap-approval-flow/);
  });
  it("Preview print form never calls the Create get_detail route", () => {
    const s = src("./prepare-web-print-form.ts");
    expect(s).not.toMatch(/sap-approver-detail|fetchSapApproverChains/);
  });
});
