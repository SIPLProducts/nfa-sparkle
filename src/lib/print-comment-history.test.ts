import { describe, expect, it } from "vitest";
import {
  mergePrintCommentSources,
  mergeCompletePrintComments,
  orderedCommentVersions,
  pairPrintCommentsWithApprovers,
  parsePrintCommentHistory,
  parseSapPrintComments,
} from "./print-comment-history";

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

  it("parses COMMENT fields in level order and ignores blanks", () => {
    expect(parseSapPrintComments(JSON.stringify({ body: JSON.stringify([{
      REFFLD: "100006",
      COMMENT3: "Third remark",
      COMMENT1: "First remark",
      COMMENT2: "  ",
    }]) }))).toEqual([
      { name: "", text: "First remark", version: undefined, level: 1 },
      { name: "", text: "Third remark", version: undefined, level: 3 },
    ]);
  });

  it("pairs comments to dynamic approvers and preserves numbered Preview history", () => {
    const api = parseSapPrintComments([{ COMMENT1: "Current one", COMMENT3: "Current three" }]);
    const merged = mergePrintCommentSources(api, [
      { name: "Old approver", text: "Old remark", version: 2 },
      { name: "Ignored current", text: "Stale current" },
    ]);
    expect(pairPrintCommentsWithApprovers(merged, [
      { role: "L1", userId: "1", name: "First approver" },
      { role: "L2", userId: "2", name: "Second approver" },
      { role: "L3", userId: "3", name: "Third approver" },
    ])).toEqual([
      { name: "First approver", text: "Current one", version: undefined, level: 1 },
      { name: "Third approver", text: "Current three", version: undefined, level: 3 },
      { name: "Old approver", text: "Old remark", version: 2 },
    ]);
  });

  it("fills missing current levels from complete saved comments without replacing SAP remarks", () => {
    const approvers = [
      { level: 1, role: "L1", userId: "1", name: "First approver" },
      { level: 3, role: "L3", userId: "3", name: "Third approver" },
    ];
    expect(mergeCompletePrintComments(
      [{ name: "", text: "SAP first", level: 1 }, { name: "Old", text: "History", version: 2 }],
      [{ name: "Saved first", text: "Saved first", level: 1 }, { name: "", text: "Saved third", level: 3 }],
      approvers,
    )).toEqual([
      { name: "Saved first", text: "SAP first", level: 1 },
      { name: "Old", text: "History", version: 2 },
      { name: "Third approver", text: "Saved third", level: 3 },
    ]);
  });
});
describe("parseSapPrintComments versioned reply", () => {
  const row = (ver: number, a3: string, c3: string) => ({
    REFFLD: "100221", VER: ver,
    APPROVER1: "1001", COMMENT1: "ok approve",
    APPROVER2: "9001", COMMENT2: "ok approve",
    APPROVER3: a3, COMMENT3: c3,
    APPROVER15: "", COMMENT15: "",
  });
  const reply = [row(1, "", "ok"), row(2, "", "ok"), row(3, "9002", "ok approve")];

  it("reads every version, highest as current", () => {
    const parsed = parseSapPrintComments(reply);
    expect(parsed.filter((c) => c.version === undefined)).toHaveLength(3);
    expect(parsed.filter((c) => c.version === 2)).toHaveLength(3);
    expect(parsed.filter((c) => c.version === 1)).toHaveLength(3);
    expect(parsed[2]).toMatchObject({ level: 3, approverId: "9002", text: "ok approve" });
  });

  it("resolves names by approver User ID, falling back to the ID", () => {
    const paired = pairPrintCommentsWithApprovers(parseSapPrintComments(reply), [
      { level: 1, role: "Site Head", userId: "1001", name: "Ravi" },
    ]);
    expect(paired[0]?.name).toBe("Ravi");
    expect(paired[1]?.name).toBe("9001");
  });

  it("still reads a single unversioned object", () => {
    expect(parseSapPrintComments({ COMMENT1: "a", COMMENT2: "" })).toEqual([
      { name: "", text: "a", version: undefined, level: 1 },
    ]);
  });
});
