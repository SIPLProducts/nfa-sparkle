import { describe, expect, it } from "vitest";
import { applyCommentNames } from "./prepare-web-print-form";
const names = { "1007": "varun yadav" };
describe("applyCommentNames", () => {
  it("shows the portal name for a comment showing User ID 1007", () => {
    expect(applyCommentNames([{ name: "1007", text: "l10", approverId: "1007" }], names)[0].name).toBe("varun yadav");
    expect(applyCommentNames([{ name: "1007", text: "l10" }], names)[0].name).toBe("varun yadav");
  });
  it("keeps real names and unknown IDs", () => {
    expect(applyCommentNames([{ name: "neethu s", text: "", approverId: "1007" }], names)[0].name).toBe("neethu s");
    expect(applyCommentNames([{ name: "2000", text: "" }], names)[0].name).toBe("2000");
  });
});
