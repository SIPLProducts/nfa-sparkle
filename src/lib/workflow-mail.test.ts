import { describe, expect, it } from "vitest";
import { pickRecipients, friendlyMailError } from "./workflow-mail.server";

const ctx = { initiator: "INIT", approvers: ["A1", "A2", "A3", "", "", "", ""] };

describe("pickRecipients", () => {
  it("approve mid-chain goes to next approver", () => {
    expect(pickRecipients("approve", { ...ctx, level: 1 })).toEqual({ people: ["A2"], final: false });
  });
  it("approve at last level goes to initiator", () => {
    expect(pickRecipients("approve", { ...ctx, level: 3 })).toEqual({ people: ["INIT"], final: true });
  });
  it("reject and back to initiator go to initiator", () => {
    expect(pickRecipients("reject", { ...ctx, level: 2 }).people).toEqual(["INIT"]);
    expect(pickRecipients("back_to_initiator", { ...ctx, level: 2 }).people).toEqual(["INIT"]);
  });
  it("clarification goes to initiator and approvers so far", () => {
    expect(pickRecipients("clarification", { ...ctx, level: 2 }).people).toEqual(["INIT", "A1", "A2"]);
  });
});

describe("friendlyMailError", () => {
  it("maps auth errors", () => {
    expect(friendlyMailError({ code: "EAUTH", message: "535" })).toMatch(/App Password/);
  });
  it("maps hosted proxy errors", () => {
    expect(friendlyMailError({ message: "proxy request failed, cannot connect" })).toMatch(/hosted preview/);
  });
});
