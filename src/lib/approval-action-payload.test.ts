import { describe, expect, it } from "vitest";
import { buildApprovalActionPayload } from "./approval-action-payload";

describe("buildApprovalActionPayload", () => {
  it("builds the five dynamic approve fields", () => {
    expect(buildApprovalActionPayload({
      action: "approve", wrapper: "approve", reffld: "200321", comment: "Approved after review",
      userName: "EMP009", filePath: "ENFA-200321.pdf", file: "JVBERi0x",
    })).toEqual({ approve: {
      user_name: "EMP009", REFFLD: "200321", Comment: "Approved after review",
      file_path: "ENFA-200321.pdf", file: "JVBERi0x",
    } });
  });

  it("preserves configured casing, fields, and a path prefix", () => {
    expect(buildApprovalActionPayload({
      action: "approve", wrapper: "approve",
      template: JSON.stringify({ Approve: { USER_NAME: "", reffld: "", comment: "", file_path: "D:\\SAP\\old.pdf", file: "", retained: true } }),
      reffld: "300111", comment: "Proceed", userName: "EMP010", filePath: "ENFA-300111.pdf", file: "JVBERi0y",
    })).toEqual({ Approve: {
      USER_NAME: "EMP010", reffld: "300111", comment: "Proceed",
      file_path: "D:\\SAP\\ENFA-300111.pdf", file: "JVBERi0y", retained: true,
    } });
  });

  it("does not add file fields to other actions", () => {
    expect(buildApprovalActionPayload({
      action: "reject", wrapper: "reject", reffld: "400101", comment: "Needs correction",
      userName: "EMP011", filePath: "ENFA-400101.pdf", file: "JVBERi0z",
    })).toEqual({ reject: { user_name: "EMP011", REFFLD: "400101", Comment: "Needs correction" } });
  });
});