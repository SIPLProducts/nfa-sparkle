import { describe, expect, it } from "vitest";
import { printFormStatusLabel, readPrintFormStatus } from "./print-form-status";

describe("Shared Print Form watermark", () => {
  it.each(["In Process", "pending", "requested clarification", "back to initiator", "rejected", "", undefined])(
    "keeps DRAFT for non-final or unknown status %s", (status) => {
      expect(printFormStatusLabel(status)).toBe("DRAFT");
    },
  );
  it("uses overall status rather than an individual completed approval", () => {
    expect(printFormStatusLabel(readPrintFormStatus({ STATUS_TXT: "In Process", STAT1: "Approved", STAT2: "" }))).toBe("DRAFT");
  });
  it("updates from DRAFT to APPROVED with the record status", () => {
    const row = { STATUS_TXT: "In Process" };
    expect(printFormStatusLabel(readPrintFormStatus(row))).toBe("DRAFT");
    row.STATUS_TXT = "Completed";
    expect(printFormStatusLabel(readPrintFormStatus(row))).toBe("APPROVED");
  });
  it("reads existing overall aliases without treating approver fields as final", () => {
    expect(readPrintFormStatus({ status: "approved" })).toBe("approved");
    expect(readPrintFormStatus({ ENFA_STATUS: "Completed" })).toBe("Completed");
    expect(readPrintFormStatus({ STAT1: "Approved" })).toBe("");
  });
});