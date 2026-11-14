import { describe, expect, it } from "vitest";
import { printFormStatusLabel, PDF_WATERMARK } from "./print-form-pdf";

describe("PDF watermark appearance", () => {
  it("matches the web watermark grey and opacity", () => expect(PDF_WATERMARK).toEqual({ gray: 119, opacity: 0.19 }));
});

describe("Print Form PDF status", () => {
  it.each(["approved", "Approved", "completed", "closed", "final", "finally approved", "final-approved"])(
    "shows Approved for final status %s",
    (status) => {
      expect(printFormStatusLabel(status)).toBe("APPROVED");
    },
  );

  it.each([undefined, "", "in process", "pending", "clarification"])(
    "keeps Draft for non-final status %s",
    (status) => {
      expect(printFormStatusLabel(status)).toBe("DRAFT");
    },
  );
});