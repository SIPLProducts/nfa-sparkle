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

  it("builds the five dynamic reject fields and preserves its configured path prefix", () => {
    expect(buildApprovalActionPayload({
      action: "reject", wrapper: "reject",
      template: JSON.stringify({ reject: { user_name: "", REFFLD: "", Comment: "", file_path: "D:\\SAP\\old.pdf", file: "" } }),
      reffld: "400101", comment: "Needs correction", userName: "EMP011",
      filePath: "ENFA-400101.pdf", file: "JVBERi0z",
    })).toEqual({ reject: {
      user_name: "EMP011", REFFLD: "400101", Comment: "Needs correction",
      file_path: "D:\\SAP\\ENFA-400101.pdf", file: "JVBERi0z",
    } });
  });

  it.each(["back_to_initiator", "clarification"] as const)("does not add file fields to %s", (action) => {
    expect(buildApprovalActionPayload({
      action, wrapper: action, reffld: "400102", comment: "Please review",
      userName: "EMP012", filePath: "ENFA-400102.pdf", file: "JVBERi0z",
    })).toEqual({
      [action === "back_to_initiator" ? "INITIATOR" : action]: {
        user_name: "EMP012", REFFLD: "400102", Comment: "Please review",
      },
    });
  });
});