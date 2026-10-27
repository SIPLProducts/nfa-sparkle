import { describe, expect, it } from "vitest";
import { parseDynamicApprovers } from "./sap-dynamic-approvers";

describe("parseDynamicApprovers ENFA number", () => {
  it("reads REFFLD", () => {
    expect(parseDynamicApprovers([{ REFFLD: "100190", USERID1: "A" }])[0].nfaNo).toBe("100190");
  });
  it("reads an alternative field name", () => {
    expect(parseDynamicApprovers([{ ENFA_NO: "100300", USERID1: "A" }])[0].nfaNo).toBe("100300");
  });
  it("prefers REFFLD when both are present", () => {
    expect(parseDynamicApprovers([{ ENFA_NO: "2", REFFLD: "1", USERID1: "A" }])[0].nfaNo).toBe("1");
  });
});
