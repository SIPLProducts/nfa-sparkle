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

  it("adds mail_id with the approver email when the template has no mail_id key", () => {
    expect(buildApprovalActionPayload({
      action: "approve", wrapper: "approve", reffld: "100136", comment: "please check 22007746",
      userName: "SIPL_QM", mailId: "thirunavukkarasu@sharviinfotech.com",
    })).toEqual({ approve: {
      user_name: "SIPL_QM", mail_id: "thirunavukkarasu@sharviinfotech.com",
      REFFLD: "100136", Comment: "please check 22007746",
    } });
  });

  it("fills an existing template mail_id key instead of duplicating it", () => {
    expect(buildApprovalActionPayload({
      action: "approve", wrapper: "approve",
      template: JSON.stringify({ approve: { user_name: "", MAIL_ID: "old@example.com", REFFLD: "", Comment: "" } }),
      reffld: "100136", comment: "ok", userName: "SIPL_QM", mailId: "new@example.com",
    })).toEqual({ approve: {
      user_name: "SIPL_QM", MAIL_ID: "new@example.com", REFFLD: "100136", Comment: "ok",
    } });
  });

  it("leaves other keys unchanged when no email is available", () => {
    expect(buildApprovalActionPayload({
      action: "approve", wrapper: "approve", reffld: "100136", comment: "ok", userName: "SIPL_QM",
    })).toEqual({ approve: {
      user_name: "SIPL_QM", REFFLD: "100136", Comment: "ok",
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