import { describe, expect, it } from "vitest";
import { printFormStatusLabel, readPrintFormStatus } from "./print-form-status";

describe("Shared Print Form watermark", () => {
  it.each(["In Process", "pending", "requested clarification", "back to initiator", "", , undefined])(
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
describe("Rejected watermark", () => {
  it.each(["Rejected", "rejected", " REJECT "])("shows REJECTED for %s", (s) => {
    expect(printFormStatusLabel(s)).toBe("REJECTED");
  });
});

import { actionPdfStatus } from "./print-form-status";
describe("action PDF status", () => {
  it("labels Reject PDFs REJECTED", () => {
    expect(printFormStatusLabel(actionPdfStatus("reject", false, "In Process"))).toBe("REJECTED");
  });
  it("labels final approval PDFs APPROVED", () => {
    expect(printFormStatusLabel(actionPdfStatus("approve", true, "In Process"))).toBe("APPROVED");
  });
  it("keeps the current status otherwise", () => {
    expect(actionPdfStatus("approve", false, "In Process")).toBe("In Process");
  });
});
