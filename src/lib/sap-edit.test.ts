import { describe, expect, it } from "vitest";
import { buildSapEditPayload, readSapEditPayload, sapEditField } from "./sap-edit";

describe("SAP My NFAs Edit", () => {
  it.each([["user_a", "21"], ["user_b", "22"]])("uses live identity %s and selected record %s", (user, number) => {
    expect(buildSapEditPayload({ edit: { user_name: "sample", reffld: "sample" } }, { user_name: user }, number))
      .toEqual({ edit: { user_name: user.toUpperCase(), reffld: number } });
  });
  it("never substitutes connection credentials for a missing User ID", () => {
    expect(() => buildSapEditPayload({ edit: { user_name: "connection" } }, {}, "21")).toThrow("User ID");
    expect(() => buildSapEditPayload({}, { user_name: "  " }, "21")).toThrow("User ID");
    expect(() => buildSapEditPayload({}, { user_name: "USER" }, " ")).toThrow("record number");
  });
  const record = { CC_TEXT: "Company", PSPNR: "Plant", NAME1: "Office", FUNCT: "Type", EXTR_TXT: "Function", SUBJECT: "Subject", SCOPE_IMPACT: "Scope", BUDGET_IMPACT: 2, TIMELINE_IMPACT: 24, TEXT: "", INIT_USERID: "INIT" };
  it.each([record, [record], { body: JSON.stringify(record) }, { data: record }])("reads supported SAP records", (value) => {
    expect(readSapEditPayload(JSON.stringify(value))).toEqual({ record, message: null });
  });
  it("reads every supplied field and preserves empty description and zero impacts", () => {
    for (const [key, value] of Object.entries(record)) expect(sapEditField(record, key)).toBe(String(value));
    expect(sapEditField({ BUDGET_IMPACT: 0 }, "BUDGET_IMPACT")).toBe("0");
    expect(sapEditField(null, "TEXT")).toBe("");
  });
  it.each(["Only the initiator may edit", JSON.stringify("Only the initiator may edit"), JSON.stringify({ ok: false, message: "Only the initiator may edit" })])("retains refusal messages", (value) => {
    expect(readSapEditPayload(value)).toEqual({ record: null, message: "Only the initiator may edit" });
  });
});
import { withSubmitUserName } from "./sap-edit";
describe("My NFAs Update user_name", () => {
  it("injects signed-in User ID first and overrides caller values", () => {
    const out = withSubmitUserName({ submit: { reffld: "1", USER_NAME: "PARDEEP", SUBJECT: "s" } }, "kvvk");
    expect(Object.keys(out.submit)[0]).toBe("user_name");
    expect(out.submit).toEqual({ user_name: "KVVK", reffld: "1", SUBJECT: "s" });
  });
  it("rejects a missing User ID", () => {
    expect(() => withSubmitUserName({ submit: {} }, " ")).toThrow("User ID");
  });
});
