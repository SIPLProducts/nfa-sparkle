import { describe, expect, it } from "vitest";
import { fillCommentNamesFromChain } from "./prepare-web-print-form";

const chain = [
  { level: 1, userId: "9001", name: "" },
  { level: 3, userId: "1003", name: "prasad kvvk" },
];

describe("fillCommentNamesFromChain", () => {
  it("replaces a numeric comment name with the chain name", () => {
    expect(fillCommentNamesFromChain([{ name: "1003", level: 3 }], chain)[0].name).toBe("prasad kvvk");
  });
  it("shows the User ID when the approver has no name", () => {
    expect(fillCommentNamesFromChain([{ name: "Approver 1", level: 1 }], chain)[0].name).toBe("9001");
  });
  it("never overwrites a real name", () => {
    expect(fillCommentNamesFromChain([{ name: "akash a", level: 3, approverId: "1003" }], chain)[0].name).toBe("akash a");
  });
});
