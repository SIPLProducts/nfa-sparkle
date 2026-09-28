import { describe, expect, it } from "vitest";
import { printFormStatusLabel } from "./print-form-pdf";

describe("Print Form PDF status", () => {
  it.each(["approved", "Approved", "completed", "closed", "final", "finally approved", "final-approved"])(
    "shows Approved for final status %s",
    (status) => {
      expect(printFormStatusLabel(status)).toBe("APPROVED");
    },
  );

  it.each([undefined, "", "in process", "pending", "rejected", "clarification"])(
    "keeps Draft for non-final status %s",
    (status) => {
      expect(printFormStatusLabel(status)).toBe("DRAFT");
    },
  );
});