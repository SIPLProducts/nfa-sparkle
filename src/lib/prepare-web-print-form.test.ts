import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: vi.fn(), comments: vi.fn(), flow: vi.fn(), draft: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "signed-in-id" }, access_token: "test-token" } } }) },
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "profiles" ? { username: "dynamic-user" } : mocks.draft() }) }) }) }),
  },
}));
vi.mock("@/lib/print-initiator.functions", () => ({ getApprovalPrintContext: mocks.saved }));
vi.mock("@/lib/print-form-data", () => ({ loadPrintComments: mocks.comments }));
vi.mock("@/lib/sap-approval-flow", async (importOriginal) => ({
  ...await importOriginal<typeof import("./sap-approval-flow")>(), fetchResolvedSapApprovalFlow: mocks.flow,
}));

import { prepareWebPrintForm, supplementPrintDetail } from "./prepare-web-print-form";
import { loadWebPreviewForm } from "./web-preview-form";

describe("complete shared web Print Form preparation", () => {
  const richDescription = '<p><strong>Full description</strong></p><table><tbody><tr><td>Retained cell</td></tr></tbody></table><img src="data:image/png;base64,AA==">';
  beforeEach(() => {
    mocks.saved.mockResolvedValue({ savedDetail: { SUBJECT: "Saved subject", ROLE7: "Final role", APPR7: "Final approver" }, initiatorName: "Saved creator", savedComments: [{ level: 7, name: "Final approver", text: "Saved final remark" }] });
    mocks.comments.mockResolvedValue([{ level: 1, name: "", text: "Live remark" }, { name: "Past approver", text: "Historical remark", version: 2 }]);
    mocks.draft.mockReturnValue({ detailed_description: richDescription });
    mocks.flow.mockResolvedValue({ functionName: "Function", approvers: Array.from({ length: 7 }, (_, index) => ({ level: index + 1, role: `Role ${index + 1}`, userId: `user-${index + 1}`, name: "" })) });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("enfa-detail")) return Response.json({ SUBJECT: "Live subject", PSPNR: "Plant", FUNCT: "Type", TEXT: "Plain SAP description", BUDGET_IMPACT: 0 });
      if (url.endsWith("enfa-select")) return Response.json({ SUBJECT: "", PSPNR: "Plant", FUNCT: "", EXTR_TXT: "Function", APPR1: "First approver", TIMELINE_IMPACT: 8 });
      return Response.json({ body: [{ REFFLD: "other", APPR1: "Wrong approver" }, { REFFLD: "record-id", CC_TEXT: "Company", APPR1: "", APPR4: "Fourth approver", BEGDA: "Record date" }] });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("supplies Preview and Print Form the same full description, seven levels and comments", async () => {
    const print = await prepareWebPrintForm("record-id", "approvals", {});
    const preview = await loadWebPreviewForm("record-id", "approvals", {}, new AbortController().signal);
    expect(preview).toMatchObject({ descriptionHtml: richDescription, companyName: "Company", initiator: "Saved creator", subject: "Live subject", budgetImpact: "0", timelineDays: "8", functionName: "Function", date: "Record date" });
    expect(preview.approvers).toEqual(print.document.approvers);
    expect(preview.approvers).toHaveLength(7);
    expect(preview.approvers?.[0]?.name).toBe("First approver");
    expect(preview.approvers?.[3]?.name).toBe("Fourth approver");
    expect(preview.comments).toEqual(print.comments);
    expect(preview.comments).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 1, name: "First approver", text: "Live remark" }),
      expect.objectContaining({ level: 7, text: "Saved final remark" }),
      expect.objectContaining({ version: 2, text: "Historical remark" }),
    ]));
  });

  it("never allows blanks or a different report record to erase detail values", () => {
    expect(supplementPrintDetail({ FUNCT: "Type", APPR1: "Name", BUDGET_IMPACT: 0 }, { funct: "", APPR1: " ", BUDGET_IMPACT: null })).toEqual({ FUNCT: "Type", APPR1: "Name", BUDGET_IMPACT: 0 });
  });

  it("uses the selected record and signed-in User ID for requests and preserves screen checks", async () => {
    await prepareWebPrintForm("record-id", "nfa_my", {});
    expect(mocks.saved).toHaveBeenCalledWith({ data: { enfaNumber: "record-id", screen: "nfa_my" } });
    const calls = vi.mocked(fetch).mock.calls;
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ edit: { user_name: "DYNAMIC-USER", reffld: "record-id" } });
    const report = JSON.parse(String(calls[2]?.[1]?.body));
    expect(JSON.stringify(report)).toContain("record-id");
    expect(JSON.stringify(report)).toContain("DYNAMIC-USER");
    expect(mocks.flow).toHaveBeenCalledWith({ plant: "Plant", nfaType: "Type", functionName: "Function" }, "test-token", undefined);
  });

  it("retains saved rich content and levels when optional SAP sources are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Gateway unavailable"); }));
    mocks.flow.mockRejectedValue(new Error("Gateway unavailable"));
    const result = await prepareWebPrintForm("record-id", "approvals", {});
    expect(result.document.description).toBe(richDescription);
    expect(result.document.approvers).toEqual([expect.objectContaining({ level: 7, name: "Final approver" })]);
    expect(result.comments).toContainEqual(expect.objectContaining({ text: "Saved final remark" }));
  });

  it("does not publish a form after Preview closes", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadWebPreviewForm("record-id", "approvals", {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});