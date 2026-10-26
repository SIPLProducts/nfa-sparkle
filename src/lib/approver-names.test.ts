import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/print-initiator.functions", () => ({}));
vi.mock("@/lib/print-form-data", () => ({}));
import { applyApproverNames } from "./prepare-web-print-form";
import { pairPrintCommentsWithApprovers } from "./print-comment-history";

describe("approver names for Print Form", () => {
  const approvers = [
    { level: 1, role: "MANAGER", userId: "9001", name: "" },
    { level: 2, role: "SCM HEAD", userId: "9002", name: "9002" },
    { level: 3, role: "PLANT HEAD", userId: "9003", name: "Kept Name" },
  ];
  it("fills blank or ID-only names from the portal", () => {
    const out = applyApproverNames(approvers, { "9001": "Ravi Kumar", "9002": "Suresh Reddy", "9003": "Other" });
    expect(out.map((a) => a.name)).toEqual(["Ravi Kumar", "Suresh Reddy", "Kept Name"]);
  });
  it("pairs comments with the resolved name by User ID", () => {
    const named = applyApproverNames(approvers, { "9002": "Suresh Reddy" });
    const [c] = pairPrintCommentsWithApprovers([{ name: "", text: "ok", level: 2, approverId: "9002" }], named);
    expect(c?.name).toBe("Suresh Reddy");
  });
});
