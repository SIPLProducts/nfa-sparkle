import { describe, it, expect } from "vitest";
import { classifyActionReply } from "./sap-action-reply";

describe("classifyActionReply", () => {
  it("empty reply is not success", () => expect(classifyActionReply("").ok).toBe(false));
  it("empty object is not success", () => expect(classifyActionReply({}).ok).toBe(false));
  it("'rejected' is success", () => expect(classifyActionReply("rejected")).toEqual({ ok: true, message: "rejected" }));
  it("initiator-only rule is an error", () =>
    expect(classifyActionReply("Note For Approval Can Only Be Rejected By Initiator").ok).toBe(false));
  it("STATUS E is an error", () => expect(classifyActionReply({ STATUS: "E", MESSAGE: "x" }).ok).toBe(false));
});
