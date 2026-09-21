import { describe, expect, it } from "vitest";
import { orderedCommentVersions, parsePrintCommentHistory } from "./print-comment-history";

describe("Print Form comment history", () => {
  it("parses current and numbered SAP comment sections without page footers", () => {
    const comments = parsePrintCommentHistory([
      "Header details",
      "Current Version Comments:",
      "Current Approver — Current remark",
      "Version 8 Comments:",
      "Older Approver",
      "ENFA No. 100068 - 1 of 2",
      "Second Older Approver",
      "Version 0 Comments:",
      "First Approver - Original remark",
      "ENFA No. 100068 - 2 of 2",
    ]);

    expect(comments).toEqual([
      { name: "Current Approver", text: "Current remark", version: undefined },
      { name: "Older Approver", text: "", version: 8 },
      { name: "Second Older Approver", text: "", version: 8 },
      { name: "First Approver", text: "Original remark", version: 0 },
    ]);
  });

  it("always orders current first, then numeric versions descending", () => {
    expect(orderedCommentVersions([
      { name: "A", text: "", version: 0 },
      { name: "B", text: "" },
      { name: "C", text: "", version: 8 },
      { name: "D", text: "", version: 3 },
    ])).toEqual([undefined, 8, 3, 0]);
  });
});