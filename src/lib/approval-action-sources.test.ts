import { describe, it, expect } from "vitest";
import { editPayloadReadsFor } from "./approval-action-sources";

describe("editPayloadReadsFor", () => {
  it("reject sends no edit-payload reads", () => expect(editPayloadReadsFor("reject")).toEqual([]));
  it("approve keeps its record reads", () =>
    expect(editPayloadReadsFor("approve")).toEqual(["/api/public/enfa-detail", "/api/public/enfa-select"]));
});
