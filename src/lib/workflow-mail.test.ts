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
  it("clarification goes to initiator and approvers before the raiser", () => {
    expect(pickRecipients("clarification", { ...ctx, level: 2 }).people).toEqual(["INIT", "A1"]);
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

describe("pickRecipients with User IDs and names", () => {
  const ctx = { initiator: ["22011077", "Sunil"], approvers: [["9001", "MGR"], ["9002"], [], [], [], [], ["9007"]] };
  it("approve goes to the next configured approver, including level 7", () => {
    expect(pickRecipients("approve", { ...ctx, level: 2 })).toEqual({ people: ["9007"], final: false });
  });
  it("final approval goes to the initiator", () => {
    expect(pickRecipients("approve", { ...ctx, level: 7 })).toEqual({ people: ["22011077", "Sunil"], final: true });
  });
  it("clarification includes initiator and approvers before the raiser", () => {
    expect(pickRecipients("clarification", { ...ctx, level: 2 }).people).toEqual(["22011077", "Sunil", "9001", "MGR"]);
  });
});

import { matchEmails } from "./workflow-mail.server";
describe("matchEmails", () => {
  const profiles = [
    { username: "9001", full_name: "thiru sharvi", email: "t@x.com", status: "ACTIVE" },
    { username: "22011077", full_name: "Sunil A", email: "s@x.com", status: "ACTIVE" },
    { username: "abaper", full_name: "sampath yadav", email: "a@x.com", status: "ACTIVE" },
    { username: "9004", full_name: "sampath yadav", email: "b@x.com", status: "ACTIVE" },
    { username: "old", full_name: "old user", email: "o@x.com", status: "DELETED" },
  ];
  it("matches User IDs case-insensitively", () => expect(matchEmails(["22011077"], profiles)).toEqual(["s@x.com"]));
  it("matches a partial SAP name when unique", () => expect(matchEmails(["SUNIL"], profiles)).toEqual(["s@x.com"]));
  it("skips ambiguous names", () => expect(matchEmails(["SAMPATH"], profiles)).toEqual([]));
  it("skips deleted users", () => expect(matchEmails(["old"], profiles)).toEqual([]));
});

import { actingLevel } from "./workflow-mail.server";
describe("server-resolved chain rules", () => {
  it("approve with no known chain emails nobody instead of the initiator", () => {
    expect(pickRecipients("approve", { initiator: "KVVK", approvers: [], level: 1 })).toEqual({ people: [], final: false });
  });
  it("finds the acting level from the approver's User ID", () => {
    expect(actingLevel(["9001", "9002", "9003"], "9002", 1)).toBe(2);
  });
  it("falls back to the screen level when the approver is not in the chain", () => {
    expect(actingLevel(["9001", "9002"], "OTHER", 1)).toBe(1);
  });
});

import { renderWorkflowMailHtml } from "./workflow-mail.server";
describe("workflow mail HTML", () => {
  it("shows ENFA no and escaped comment", () => {
    const h = renderWorkflowMailHtml({ action: "clarification", final: false, heading: "x", label: "Clarification requested", enfaNo: "100183", subject: "test3", actor: "9002", comment: "<b>check</b>", date: new Date() });
    expect(h).toContain("100183");
    expect(h).toContain("&lt;b&gt;check&lt;/b&gt;");
    expect(h).not.toContain("<b>check</b>");
  });
});

describe("approval sequence", () => {
  const chain = Array.from({ length: 15 }, (_, i) => `A${i + 1}`);
  const ctx = (level: number) => ({ initiator: "INIT", approvers: chain, level });
  it("initiator Approve goes to approver 1", () => {
    const lv = actingLevel(chain, "INIT", 1, ["INIT"]);
    expect(lv).toBe(0);
    expect(pickRecipients("approve", ctx(lv)).people).toEqual(["A1"]);
  });
  it("level 1 goes to level 2", () => {
    expect(pickRecipients("approve", ctx(actingLevel(chain, "A1", 1, ["INIT"]))).people).toEqual(["A2"]);
  });
  it("level 15 is final and goes to initiator", () => {
    expect(pickRecipients("approve", ctx(actingLevel(chain, "A15", 1, ["INIT"])))).toEqual({ people: ["INIT"], final: true });
  });
});

describe("clarification recipients", () => {
  const ctx = (level: number) => ({ initiator: "INIT", approvers: ["A1", "A2", "A3"], level });
  it("level 3 raiser → initiator + approvers 1,2", () => {
    expect(pickRecipients("clarification", ctx(3)).people).toEqual(["INIT", "A1", "A2"]);
  });
  it("level 1 raiser → initiator only", () => {
    expect(pickRecipients("clarification", ctx(1)).people).toEqual(["INIT"]);
  });
});

import { renderWorkflowMailHtml as renderSig } from "./workflow-mail.server";
describe("workflow mail signature", () => {
  const base = { action: "reject" as const, final: false, heading: "Rejected", label: "Rejected", enfaNo: "1", actor: "A", comment: "", date: new Date("2026-10-22T10:00:00Z") };
  it("signs with the configured sender name, escaped", () => {
    const h = renderSig({ ...base, senderName: "Ramky <ENFA>" });
    expect(h).toContain("Regards,");
    expect(h).toContain("Ramky &lt;ENFA&gt;");
  });
  it("falls back to eNFA Portal when blank", () => {
    expect(renderSig({ ...base, senderName: " " })).toContain("eNFA Portal</p>");
  });
});

import { savedChainIds, pickRecipients as pick2 } from "./workflow-mail.server";
it("saved dynamic chain routes initiator's submit to the first selected approver", () => {
  const chain = savedChainIds([{ level: 1, userId: "9003" }, { level: 2, userId: "9005" }]);
  expect(chain).toEqual(["9003", "9005"]);
  expect(pick2("approve", { initiator: ["PRADEEP"], approvers: chain.map((c) => [c]), level: 0 }).people).toEqual(["9003"]);
  expect(pick2("approve", { initiator: ["PRADEEP"], approvers: chain.map((c) => [c]), level: 1 }).people).toEqual(["9005"]);
});
