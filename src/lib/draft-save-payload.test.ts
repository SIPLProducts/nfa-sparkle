import { describe, expect, it } from "vitest";
import { coreDraftPayload } from "./draft-save-payload";

describe("coreDraftPayload", () => {
  it("keeps the description and core fields, drops newer columns", () => {
    const out = coreDraftPayload({
      enfa_number: "100231",
      subject: "hi",
      detailed_description: "<p>desc</p>",
      approvers: [{ level: 1 }],
      approver_mode: "dynamic",
      initiator_name: "x",
      function_name: "PROJECTS",
    });
    expect(out).toEqual({ enfa_number: "100231", subject: "hi", detailed_description: "<p>desc</p>" });
  });
});
