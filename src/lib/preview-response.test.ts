import { describe, expect, it } from "vitest";
import { classifyPreviewResponse } from "./preview-response";

describe("SAP response-driven Preview", () => {
  const pdf = btoa("%PDF-1.3\nExample PDF bytes");
  it.each([pdf, JSON.stringify(pdf), JSON.stringify({ body: pdf })])("selects SAP for a PDF: %s", (raw) => {
    expect(classifyPreviewResponse(raw)).toEqual({ source: "sap", base64: pdf });
  });
  it.each(["X", '"X"', '  "X"  ', '{"body":"X"}'])("selects web only for X: %s", (raw) => {
    expect(classifyPreviewResponse(raw)).toEqual({ source: "web" });
  });
  it.each(["", "null", "No document found", "Unauthorized", "<html>Gateway error</html>", btoa("Not a PDF"), '{"ok":false,"body":"X"}', '{"error":"X"}', '"x"'])("does not silently fall back for %s", (raw) => {
    expect(classifyPreviewResponse(raw).source).toBe("error");
  });
});