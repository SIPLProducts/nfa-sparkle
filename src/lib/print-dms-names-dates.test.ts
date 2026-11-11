import { describe, it, expect } from "vitest";
import { pairPrintCommentsWithApprovers, stampActingApproverDate } from "./print-comment-history";

const chain = [
  { level: 1, role: "site head", userId: "1001", name: "akash A", actedDate: "2026-11-11" },
  { level: 2, role: "SCM HEAD", userId: "9002", name: "prasad sharvi", actedDate: "" },
];

describe("DMS print form", () => {
  it("shows approver name instead of User ID in comments", () => {
    const out = pairPrintCommentsWithApprovers([{ name: "9002", text: "approved" }], chain);
    expect(out[0].name).toBe("prasad sharvi");
  });
  it("stamps today's date on the acting (last) approver when SAP has none", () => {
    const out = stampActingApproverDate(chain, 2, "9002", new Date(2026, 10, 11));
    expect(out[1].actedDate).toBe("2026-11-11");
  });
  it("never overwrites an SAP date", () => {
    const out = stampActingApproverDate(chain, 1, "1001", new Date(2027, 0, 1));
    expect(out[0].actedDate).toBe("2026-11-11");
  });
});

describe("final approver date lookup", () => {
  const d = new Date(2026, 10, 11);
  it("stamps 9002 even when the acting level is past the chain", () => {
    expect(stampActingApproverDate(chain, 3, "9002", d)[1].actedDate).toBe("2026-11-11");
  });
  it("matches a padded SAP User ID", () => {
    expect(stampActingApproverDate(chain, 3, "00009002", d)[1].actedDate).toBe("2026-11-11");
  });
  it("falls back to the first undated box after dated ones", () => {
    expect(stampActingApproverDate(chain, 9, "", d)[1].actedDate).toBe("2026-11-11");
  });
  it("never replaces an existing SAP date", () => {
    expect(stampActingApproverDate(chain, 1, "1001", new Date(2027, 0, 1))[0].actedDate).toBe("2026-11-11");
  });
});
