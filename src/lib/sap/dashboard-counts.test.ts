import { describe, expect, it } from "vitest";
import { buildDashboardCountsPayload, parseDashboardCounts } from "./dashboard-counts";

describe("Dashboard counts", () => {
  it("builds payload for the signed-in user", () => {
    expect(buildDashboardCountsPayload("sipl_qm")).toEqual({ dashboard: { user_name: "SIPL_QM" } });
  });
  it("maps the sample response to the five cards", () => {
    expect(parseDashboardCounts({ LV_REJ: 21, LV_COMP: 25, LV_INP: 48, LV_REQ: 2, LV_WITH: 6 }))
      .toEqual({ pending: 48, approved: 25, rejected: 21, backToInitiator: 6, clarification: 2 });
  });
  it("returns null when SAP sends no counts", () => {
    expect(parseDashboardCounts({ message: "x" })).toBeNull();
  });
});
